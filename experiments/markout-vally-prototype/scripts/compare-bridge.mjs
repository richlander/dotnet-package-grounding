import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { classify, iet } from "./classification.mjs";
import {
  readManifest,
  readTrials,
  sha256File,
  taskId,
  validateArm,
  validateCustomBridge,
  validateManifestPins,
} from "./vally-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const customPath = path.join(
  root, "bridge-results", "custom", "markout-skill-doc-stripped.haiku.json"
);
const vallyRoot = path.join(root, "bridge-results", "vally");
const manifest = await readManifest(path.join(root, "grader-manifest.ct24.json"));
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
validateManifestPins(manifest, pins.ct24);
const totalTrials = manifest.tasks.length * manifest.k;
const applicability = JSON.parse(
  await readFile(path.join(root, "applicability.markout-ct24.json"), "utf8")
);
const evalSpec = parse(await readFile(path.join(root, "eval.ct24.yaml"), "utf8"));
const rejectedToolsByTask = new Map(evalSpec.stimuli.map((stimulus) => [
  taskId(stimulus.name),
  new Set(stimulus.constraints?.reject_tools ?? []),
]));
if ([...rejectedToolsByTask.values()].some((tools) =>
  [...tools].some((tool) => tool !== "web_search" && tool !== "web_fetch"))) {
  throw new Error("custom bridge exposes only aggregate web-tool counts; non-web reject_tools cannot be compared");
}
const custom = JSON.parse(await readFile(customPath, "utf8"));
validateCustomBridge(custom, manifest, {
  markoutSourceCommit: pins.markout.sourceCommit,
  sourceEvalHash: pins.ct24.sourceEvalHash,
  sdkVersion: pins.dotnet.sdkVersion,
  overlayEvalHash: pins.customBridge.sdkOverlayEvalHash,
  skillValidatorCommit: pins.customBridge.skillValidatorCommit,
  copilotCliVersion: pins.customBridge.copilotCliVersion,
});
const vallyBaselinePath = path.join(vallyRoot, "baseline", "results.jsonl");
const vallyGroundedPath = path.join(vallyRoot, "grounded", "results.jsonl");
const vallyBaseline = await readTrials(vallyBaselinePath);
const vallyGrounded = await readTrials(vallyGroundedPath);
validateArm(vallyBaseline, { arm: "baseline", manifest });
validateArm(vallyGrounded, { arm: "grounded", manifest, requireActivation: true });
await verifyRepairManifest(
  path.join(vallyRoot, "repair-manifest.json"),
  vallyBaselinePath,
  vallyGroundedPath,
  vallyBaseline,
  manifest
);

const expectedByTask = new Map();
for (const skill of applicability.skills) {
  if (skill.name === "markout") continue;
  for (const task of skill.tasks) expectedByTask.set(task, skill);
}
for (const task of applicability.skills.find((skill) => skill.name === "markout").tasks) {
  if (!expectedByTask.has(task)) {
    expectedByTask.set(task, applicability.skills.find((skill) => skill.name === "markout"));
  }
}

const customRows = custom.verdicts[0].scenarios.map((scenario) => {
  const task = taskId(scenario.scenarioName);
  return {
    task,
    name: scenario.scenarioName,
    baseline: customArm(scenario.baseline.metrics.perRun),
    grounded: customArm(scenario.skilledPlugin.metrics.perRun),
    baselineRejectedToolCalls: scenario.baseline.metrics.toolStats.web * manifest.k,
    groundedRejectedToolCalls: scenario.skilledPlugin.metrics.toolStats.web * manifest.k,
    expectedPulls: scenario.skillActivationPluginPerRun.filter((run) =>
      expectedByTask.get(task).activationNames.some((name) => run.detectedSkills?.includes(name))
    ).length,
    anyPulls: scenario.skillActivationPluginPerRun.filter((run) => run.detectedSkills?.length > 0).length,
  };
});
const vallyRows = groupTasks(vallyBaseline, vallyGrounded).map(({ task, name, baseline, grounded }) => ({
  task,
  name,
  baseline: vallyArm(baseline),
  grounded: vallyArm(grounded),
  baselineRejectedToolCalls: rejectedToolCalls(baseline, rejectedToolsByTask.get(task)),
  groundedRejectedToolCalls: rejectedToolCalls(grounded, rejectedToolsByTask.get(task)),
  expectedPulls: grounded.filter((record) =>
    expectedByTask.get(task).activationNames.some(
      (skill) => (record.trajectory.metrics.skillActivationBreakdown[skill] ?? 0) > 0
    )
  ).length,
  anyPulls: grounded.filter(
    (record) => Object.values(record.trajectory.metrics.skillActivationBreakdown).some((count) => count > 0)
  ).length,
}));

const customSummary = summarizePlane(customRows);
const vallySummary = summarizePlane(vallyRows);
const rows = customRows.map((customRow) => {
  const vallyRow = vallyRows.find((row) => row.task === customRow.task);
  return {
    task: customRow.task,
    customBaseline: customRow.baseline.delivered,
    vallyBaseline: vallyRow.baseline.delivered,
    customGrounded: customRow.grounded.delivered,
    vallyGrounded: vallyRow.grounded.delivered,
    customExpectedPulls: customRow.expectedPulls,
    vallyExpectedPulls: vallyRow.expectedPulls,
  };
});

const output = [];
output.push("# Contemporaneous CT-24 execution-plane bridge", "");
output.push("| Metric | Custom harness | Vally | Difference (Vally - custom) |");
output.push("|---|---:|---:|---:|");
output.push(metric("Baseline Delivered", customSummary.baselineDelivered, vallySummary.baselineDelivered, totalTrials));
output.push(metric("Grounded Delivered", customSummary.groundedDelivered, vallySummary.groundedDelivered, totalTrials));
output.push(decimalMetric("Reliability lift", customSummary.reliability, vallySummary.reliability));
output.push(decimalMetric("Grounded fidelity", customSummary.groundedFidelity, vallySummary.groundedFidelity));
output.push(decimalMetric("Do-no-harm loss mass", customSummary.loss, vallySummary.loss));
output.push(decimalMetric("Expected-skill retrieval", customSummary.expectedPulls / totalTrials, vallySummary.expectedPulls / totalTrials));
output.push(decimalMetric("Any-skill retrieval", customSummary.anyPulls / totalTrials, vallySummary.anyPulls / totalTrials));
output.push(decimalMetric(
  "Rejected-tool calls / trial",
  customSummary.rejectedToolCalls / (2 * totalTrials),
  vallySummary.rejectedToolCalls / (2 * totalTrials)
));
output.push(ratioMetric("Total-IET ratio", customSummary.totalIetRatio, vallySummary.totalIetRatio));
output.push(ratioMetric("Levelized-IET geo", customSummary.levelizedGeo, vallySummary.levelizedGeo));
output.push(ratioMetric("Duration geo", customSummary.durationGeo, vallySummary.durationGeo));
output.push("", "| Task | Baseline Delivered custom / Vally | Grounded Delivered custom / Vally | Expected pulls custom / Vally |");
output.push("|---|---:|---:|---:|");
for (const row of rows) {
  output.push(`| ${row.task} | ${row.customBaseline}/5 / ${row.vallyBaseline}/5 | ${row.customGrounded}/5 / ${row.vallyGrounded}/5 | ${row.customExpectedPulls}/5 / ${row.vallyExpectedPulls}/5 |`);
}

const markdown = `${output.join("\n")}\n`;
await writeFile(path.join(root, "bridge-results", "comparison.md"), markdown);
await writeFile(path.join(root, "bridge-results", "comparison.json"), JSON.stringify({
  schema: 1,
  custom: customSummary,
  vally: vallySummary,
  tasks: rows,
}, null, 2));
process.stdout.write(markdown);

function customArm(runs) {
  const normalized = runs.map((run) => {
    const satisfies = run.satisfiesAssertionsTotal > 0 &&
      run.satisfiesAssertionsPassed === run.satisfiesAssertionsTotal;
    const delivers = satisfies && run.deliversAssertionsTotal > 0 &&
      run.deliversAssertionsPassed === run.deliversAssertionsTotal;
    return {
      grade: delivers ? "Delivers" : satisfies ? "Satisfies" : "Fails",
      iet: anthropicIet(run.inputTokens, run.cacheReadTokens, run.outputTokens),
      durationMs: run.wallTimeMs,
    };
  });
  return summarizeArm(normalized);
}

function vallyArm(records) {
  return summarizeArm(records.map((record) => ({
    grade: classify(record),
    iet: iet(record),
    durationMs: record.durationMs,
  })));
}

function summarizeArm(runs) {
  const deliveredRuns = runs.filter((run) => run.grade === "Delivers");
  const working = runs.filter((run) => run.grade !== "Fails");
  return {
    k: runs.length,
    fails: runs.length - working.length,
    satisfies: working.length - deliveredRuns.length,
    delivered: deliveredRuns.length,
    yield: deliveredRuns.length / runs.length,
    fidelity: working.length === 0 ? null : deliveredRuns.length / working.length,
    medianDeliveredIet: median(deliveredRuns.map((run) => run.iet)),
    levelizedIet: deliveredRuns.length === 0
      ? null
      : runs.reduce((sum, run) => sum + run.iet, 0) / deliveredRuns.length,
    medianDeliveredDurationMs: median(deliveredRuns.map((run) => run.durationMs)),
  };
}

function summarizePlane(rows) {
  const baselineDelivered = sum(rows.map((row) => row.baseline.delivered));
  const groundedDelivered = sum(rows.map((row) => row.grounded.delivered));
  const baselineWorking = sum(rows.map((row) => row.baseline.satisfies + row.baseline.delivered));
  const groundedWorking = sum(rows.map((row) => row.grounded.satisfies + row.grounded.delivered));
  const shared = rows.filter((row) => row.baseline.delivered > 0 && row.grounded.delivered > 0);
  return {
    baselineDelivered,
    groundedDelivered,
    reliability: groundedDelivered / totalTrials - baselineDelivered / totalTrials,
    baselineFidelity: baselineWorking === 0 ? null : baselineDelivered / baselineWorking,
    groundedFidelity: groundedWorking === 0 ? null : groundedDelivered / groundedWorking,
    loss: sum(rows.map((row) => Math.max(row.baseline.yield - row.grounded.yield, 0))),
    expectedPulls: sum(rows.map((row) => row.expectedPulls)),
    anyPulls: sum(rows.map((row) => row.anyPulls)),
    rejectedToolCalls: sum(rows.map((row) =>
      row.baselineRejectedToolCalls + row.groundedRejectedToolCalls
    )),
    coverage: {
      both: rows.filter((row) => row.baseline.delivered > 0 && row.grounded.delivered > 0).length,
      groundedOnly: rows.filter((row) => row.baseline.delivered === 0 && row.grounded.delivered > 0).length,
      baselineOnly: rows.filter((row) => row.baseline.delivered > 0 && row.grounded.delivered === 0).length,
      neither: rows.filter((row) => row.baseline.delivered === 0 && row.grounded.delivered === 0).length,
    },
    sharedTasks: shared.length,
    totalIetRatio: ratio(
      sum(shared.map((row) => row.grounded.medianDeliveredIet)),
      sum(shared.map((row) => row.baseline.medianDeliveredIet))
    ),
    levelizedGeo: geoMean(shared.map((row) => ratio(row.grounded.levelizedIet, row.baseline.levelizedIet))),
    durationGeo: geoMean(shared.map((row) =>
      ratio(row.grounded.medianDeliveredDurationMs, row.baseline.medianDeliveredDurationMs)
    )),
  };
}

function groupTasks(baseline, grounded) {
  const names = [...new Set([...baseline, ...grounded].map((record) => record.stimulus))].sort();
  return names.map((name) => ({
    task: taskId(name),
    name,
    baseline: baseline.filter((record) => record.stimulus === name),
    grounded: grounded.filter((record) => record.stimulus === name),
  }));
}

function anthropicIet(input, cacheRead, output) {
  const cached = Math.min(input, Math.max(0, cacheRead));
  return 1.25 * (input - cached) + 0.1 * cached + 5 * output;
}

function rejectedToolCalls(records, rejectedTools) {
  return sum(records.map((record) =>
    (record.trajectory?.events ?? []).filter((event) =>
      event.type === "tool_call" && rejectedTools.has(event.data?.toolName)
    ).length
  ));
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function geoMean(values) {
  return values.length === 0 || values.some((value) => value == null || value <= 0)
    ? null
    : Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

function ratio(numerator, denominator) {
  return numerator == null || denominator == null || denominator === 0 ? null : numerator / denominator;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function metric(label, customValue, vallyValue, denominator) {
  return `| ${label} | ${customValue}/${denominator} | ${vallyValue}/${denominator} | ${signed(vallyValue - customValue)} trials |`;
}

function decimalMetric(label, customValue, vallyValue) {
  return `| ${label} | ${decimal(customValue)} | ${decimal(vallyValue)} | ${signed(vallyValue - customValue)} |`;
}

function ratioMetric(label, customValue, vallyValue) {
  return `| ${label} | ${multiple(customValue)} | ${multiple(vallyValue)} | ${signed(vallyValue - customValue)} |`;
}

function decimal(value) {
  return value == null ? "n/a" : value.toFixed(3);
}

function multiple(value) {
  return value == null ? "n/a" : `×${value.toFixed(2)}`;
}

function signed(value) {
  return value == null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

async function verifyRepairManifest(file, baselinePath, groundedPath, baseline, graderManifest) {
  const repair = JSON.parse(await readFile(file, "utf8"));
  if (repair.schema !== 1 ||
      repair.graderManifest?.hash !== graderManifest.hash ||
      repair.graderManifest?.evalHash !== graderManifest.evalHash ||
      repair.executionInputs?.evalHash !== pins.ct24.vallyEvalHash ||
      repair.executionInputs?.fixtureHash !== pins.ct24.fixtureHash ||
      repair.executionInputs?.shelfHash !== pins.shelf.hash ||
      repair.files?.canonicalBaseline?.hash !== await sha256File(baselinePath) ||
      repair.files?.canonicalGrounded?.hash !== await sha256File(groundedPath)) {
    throw new Error("Vally repair manifest does not attest the canonical bridge inputs");
  }
  for (const [label, entry] of [
    ["source baseline", repair.files?.source?.baseline],
    ["source grounded", repair.files?.source?.grounded],
    ...Object.entries(repair.files?.repairs ?? {}).flatMap(([arm, values]) =>
      (values ?? []).map((value, index) => [`repair ${arm} attempt ${index + 1}`, value])
    ),
  ]) {
    if (!entry?.path || entry.hash !== await sha256File(entry.path)) {
      throw new Error(`Vally repair manifest source hash mismatch: ${label}`);
    }
  }
  const affectedCount = ["baseline", "grounded"]
    .reduce((sum, arm) => sum + (repair.affectedTasks?.[arm]?.length ?? 0), 0);
  if (!Array.isArray(repair.affectedTasks?.baseline) ||
      !Array.isArray(repair.affectedTasks?.grounded) ||
      !Array.isArray(repair.replacements) ||
      repair.replacements.length !== affectedCount * graderManifest.k) {
    throw new Error("Vally repair manifest has an incomplete replacement set");
  }
  const canonicalById = new Map(
    [...baseline, ...await readTrials(groundedPath)].map((record) => [record.itemId, record])
  );
  for (const mapping of repair.replacements) {
    const record = canonicalById.get(mapping.canonicalItemId);
    if (!record ||
        record.variant !== mapping.arm ||
        record.repair?.sourceVariant !== "main" ||
        record.repair?.originalItemId !== mapping.originalItemId) {
      throw new Error(`Vally repair provenance mismatch: ${mapping.canonicalItemId}`);
    }
  }
}
