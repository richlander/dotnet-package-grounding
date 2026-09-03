import { readFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./grader-manifest.mjs";

export async function readManifest(file) {
  const bytes = await readFile(file);
  const manifest = JSON.parse(bytes);
  if (manifest.schema !== 1 || !manifest.evalName || !manifest.evalFile ||
      !manifest.evalHash || !manifest.model || !Number.isInteger(manifest.k) ||
      manifest.k <= 0 || !Array.isArray(manifest.tasks) || manifest.tasks.length === 0) {
    throw new Error(`${file}: invalid grader manifest`);
  }
  manifest.file = file;
  manifest.hash = sha256(bytes);
  manifest.byName = new Map(manifest.tasks.map((task) => [task.name, task]));
  manifest.byId = new Map(manifest.tasks.map((task) => [task.id, task]));
  if (manifest.byName.size !== manifest.tasks.length || manifest.byId.size !== manifest.tasks.length) {
    throw new Error(`${file}: duplicate task names or ids`);
  }
  return manifest;
}

export function validateManifestPins(manifest, pins) {
  if (manifest.hash !== pins.graderManifestHash || manifest.evalHash !== pins.vallyEvalHash) {
    throw new Error(
      `grader manifest provenance mismatch: expected ${pins.graderManifestHash} / ${pins.vallyEvalHash}, ` +
      `got ${manifest.hash} / ${manifest.evalHash}`
    );
  }
}

export async function readTrials(file) {
  return (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}:${index + 1}: ${error.message}`);
      }
    })
    .filter((record) => record.type === "trial-result");
}

export function validateArm(records, {
  arm,
  manifest,
  expectedTaskIds = manifest.tasks.map((task) => task.id),
  allowExecutionErrors = false,
  allowDirectEval = false,
  requireActivation = false,
}) {
  const taskIds = [...expectedTaskIds].sort();
  const expectedTasks = taskIds.map((id) => {
    const task = manifest.byId.get(id);
    if (!task) throw new Error(`${arm}: unknown expected task ${id}`);
    return task;
  });
  if (records.length !== expectedTasks.length * manifest.k) {
    throw new Error(`${arm}: expected ${expectedTasks.length * manifest.k} trials, found ${records.length}`);
  }
  const actualNames = new Set(records.map((record) => record.stimulus));
  const expectedNames = new Set(expectedTasks.map((task) => task.name));
  const missing = [...expectedNames].filter((name) => !actualNames.has(name));
  const extra = [...actualNames].filter((name) => !expectedNames.has(name));
  if (missing.length || extra.length) {
    throw new Error(`${arm}: task set mismatch; missing [${missing.join(", ")}], extra [${extra.join(", ")}]`);
  }

  for (const task of expectedTasks) {
    const taskRecords = records.filter((record) => record.stimulus === task.name);
    if (taskRecords.length !== manifest.k) {
      throw new Error(`${task.id}/${arm}: expected ${manifest.k} trials, found ${taskRecords.length}`);
    }
    const indexes = taskRecords.map(trialIndex).sort((left, right) => left - right);
    const expectedIndexes = Array.from({ length: manifest.k }, (_, index) => index);
    if (indexes.some((value, index) => value !== expectedIndexes[index])) {
      throw new Error(`${task.id}/${arm}: duplicate or missing trial indexes`);
    }
    for (const record of taskRecords) {
      validateRecord(record, task, arm, manifest, {
        allowExecutionErrors,
        allowDirectEval,
        requireActivation,
      });
    }
  }
}

export function validateCustomBridge(custom, manifest, expectedProvenance) {
  if (expectedProvenance) {
    for (const [name, value] of Object.entries(expectedProvenance)) {
      if (custom.bridgeProvenance?.[name] !== value) {
        throw new Error(`custom bridge: provenance mismatch for ${name}`);
      }
    }
  }
  const scenarios = custom?.verdicts?.[0]?.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length !== manifest.tasks.length) {
    throw new Error(`custom bridge: expected ${manifest.tasks.length} scenarios`);
  }
  const seen = new Set();
  for (const scenario of scenarios) {
    const id = taskId(scenario.scenarioName);
    const task = manifest.byId.get(id);
    if (!task || scenario.scenarioName !== task.name || !seen.add(id)) {
      throw new Error(`custom bridge: unexpected or duplicate scenario '${scenario.scenarioName}'`);
    }
    validateCustomRuns(`${id}/baseline`, scenario.baseline?.metrics?.perRun, manifest.k);
    validateCustomRuns(`${id}/grounded`, scenario.skilledPlugin?.metrics?.perRun, manifest.k);
    if (![scenario.baseline?.metrics?.toolStats, scenario.skilledPlugin?.metrics?.toolStats]
      .every((stats) =>
        stats?.runs === manifest.k &&
        Number.isFinite(stats.web) &&
        stats.web >= 0)) {
      throw new Error(`${id}: custom bridge is missing aggregate rejected-tool data`);
    }
    if (scenario.failedRunCount !== 0 ||
        scenario.timedOut === true ||
        scenario.baseline?.metrics?.timedOut === true ||
        scenario.skilledPlugin?.metrics?.timedOut === true) {
      throw new Error(`${id}: custom bridge contains failed or timed-out executions`);
    }
    rejectInfrastructureEvidence(id, scenario);
    if (!Array.isArray(scenario.skillActivationPluginPerRun) ||
        scenario.skillActivationPluginPerRun.length !== manifest.k) {
      throw new Error(`${id}/grounded: expected ${manifest.k} activation records`);
    }
  }
  if (seen.size !== manifest.tasks.length) {
    throw new Error("custom bridge: incomplete task set");
  }
}

export async function sha256File(file) {
  return sha256(await readFile(file));
}

export function taskId(stimulus) {
  const match = /^CT\d{2}/.exec(stimulus ?? "");
  if (!match) throw new Error(`cannot parse task id from '${stimulus}'`);
  return match[0];
}

export function trialIndex(record) {
  if (Number.isInteger(record.trialIndex)) return record.trialIndex;
  const match = /::trial-(\d+)$/.exec(record.itemId ?? "");
  if (!match) throw new Error(`cannot parse trial index from '${record.itemId}'`);
  return Number(match[1]);
}

function validateRecord(
  record,
  task,
  arm,
  manifest,
  { allowExecutionErrors, allowDirectEval, requireActivation }
) {
  const index = trialIndex(record);
  if (record.variant !== arm || record.model !== manifest.model) {
    throw new Error(`${task.id}/${arm}/trial-${index}: variant or model mismatch`);
  }
  if (record.totalTrials != null && record.totalTrials !== manifest.k) {
    throw new Error(`${task.id}/${arm}/trial-${index}: totalTrials mismatch`);
  }
  if (record.evalName !== manifest.evalName || !record.evalFilePath || !record.itemId) {
    throw new Error(`${task.id}/${arm}/trial-${index}: evalName mismatch`);
  }
  if (path.basename(record.evalFilePath) !== manifest.evalFile) {
    throw new Error(`${task.id}/${arm}/trial-${index}: evalFilePath mismatch`);
  }
  const suffix = `::${arm}::${manifest.model}::${task.name}::trial-${index}`;
  if (!record.itemId.endsWith(suffix)) {
    throw new Error(`${task.id}/${arm}/trial-${index}: itemId identity mismatch`);
  }
  if (record.experiment) {
    const expectedHash = manifest.evalHash.replace(/^sha256:/, "").slice(0, 16);
    if (record.experiment.evalHash !== expectedHash ||
        record.experiment.variant !== arm ||
        path.basename(record.experiment.evalFile ?? "") !== manifest.evalFile) {
      throw new Error(`${task.id}/${arm}/trial-${index}: experiment provenance mismatch`);
    }
  } else if (record.repair) {
    const originalSuffix = `::main::${manifest.model}::${task.name}::trial-${index}`;
    if (record.repair.sourceVariant !== "main" ||
        !record.repair.repairRun ||
        !record.repair.originalItemId?.endsWith(originalSuffix)) {
      throw new Error(`${task.id}/${arm}/trial-${index}: repair provenance mismatch`);
    }
  } else if (!allowDirectEval) {
    throw new Error(`${task.id}/${arm}/trial-${index}: missing experiment provenance`);
  }
  if (record.status !== "success") {
    if (allowExecutionErrors) return;
    throw new Error(`${task.id}/${arm}/trial-${index}: execution status is ${record.status}`);
  }
  if (!(record.durationMs > 0)) {
    throw new Error(`${task.id}/${arm}/trial-${index}: invalid duration`);
  }
  const usage = record.trajectory?.metrics?.tokenUsage;
  if (!usage || [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens]
    .some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error(`${task.id}/${arm}/trial-${index}: invalid token metrics`);
  }
  if (requireActivation && !record.trajectory?.metrics?.skillActivationBreakdown) {
    throw new Error(`${task.id}/${arm}/trial-${index}: missing skill activation breakdown`);
  }
  validateGraders(record, task, arm, index);
}

function validateGraders(record, task, arm, index) {
  const details = record.gradeResult?.details;
  if (!Array.isArray(details)) {
    throw new Error(`${task.id}/${arm}/trial-${index}: missing grader details`);
  }
  const expected = new Map(task.graders.map((grader) => [grader.name, grader.type]));
  const actual = new Map();
  for (const grader of details) {
    if (!grader.name || actual.has(grader.name) || typeof grader.passed !== "boolean") {
      throw new Error(`${task.id}/${arm}/trial-${index}: missing or duplicate grader name`);
    }
    actual.set(grader.name, grader.graderType);
  }
  if (actual.size !== expected.size) {
    throw new Error(`${task.id}/${arm}/trial-${index}: grader count mismatch`);
  }
  for (const [name, type] of expected) {
    if (actual.get(name) !== type) {
      throw new Error(`${task.id}/${arm}/trial-${index}: grader '${name}' missing or type-mismatched`);
    }
  }
  const failedHarness = details.find(
    (grader) => grader.name.startsWith("harness/") && grader.passed !== true
  );
  if (failedHarness) {
    throw new Error(`${task.id}/${arm}/trial-${index}: harness grader '${failedHarness.name}' failed`);
  }
}

function validateCustomRuns(label, runs, k) {
  if (!Array.isArray(runs) || runs.length !== k) {
    throw new Error(`${label}: expected ${k} runs`);
  }
  for (const [index, run] of runs.entries()) {
    if (!(run.satisfiesAssertionsTotal > 0) ||
        !(run.deliversAssertionsTotal > 0) ||
        run.satisfiesAssertionsPassed < 0 ||
        run.satisfiesAssertionsPassed > run.satisfiesAssertionsTotal ||
        run.deliversAssertionsPassed < 0 ||
        run.deliversAssertionsPassed > run.deliversAssertionsTotal ||
        !(run.wallTimeMs > 0) ||
        [run.inputTokens, run.outputTokens, run.cacheReadTokens]
          .some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error(`${label}/run-${index}: invalid metrics`);
    }
  }

}

function rejectInfrastructureEvidence(task, scenario) {
  const evidence = JSON.stringify([
    scenario.baseline?.metrics?.assertionResults,
    scenario.skilledPlugin?.metrics?.assertionResults,
  ]);
  const patterns = [
    /sdk\/11\.\d+\.\d+-preview/i,
    /NU1101[^\n]*Microsoft\.NETCore\.App/i,
    /Access to the path [^'\n]*\.nuget\/packages\/microsoft\.netcore\.app/i,
  ];
  const match = patterns.find((pattern) => pattern.test(evidence));
  if (match) {
    throw new Error(`${task}: custom bridge contains SDK/NuGet infrastructure failure evidence`);
  }
}
