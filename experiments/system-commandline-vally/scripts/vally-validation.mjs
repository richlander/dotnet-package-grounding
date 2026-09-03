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

export function validateArm(records, { arm, manifest, requireActivation = false }) {
  if (records.length !== manifest.tasks.length * manifest.k) {
    throw new Error(`${arm}: expected ${manifest.tasks.length * manifest.k} trials, found ${records.length}`);
  }
  const actualNames = new Set(records.map((record) => record.stimulus));
  const expectedNames = new Set(manifest.tasks.map((task) => task.name));
  const missing = [...expectedNames].filter((name) => !actualNames.has(name));
  const extra = [...actualNames].filter((name) => !expectedNames.has(name));
  if (missing.length || extra.length) {
    throw new Error(`${arm}: task set mismatch; missing [${missing.join(", ")}], extra [${extra.join(", ")}]`);
  }

  for (const task of manifest.tasks) {
    const taskRecords = records.filter((record) => record.stimulus === task.name);
    if (taskRecords.length !== manifest.k) {
      throw new Error(`${task.id}/${arm}: expected ${manifest.k} trials, found ${taskRecords.length}`);
    }
    const indexes = taskRecords.map(trialIndex).sort((left, right) => left - right);
    if (indexes.some((value, index) => value !== index)) {
      throw new Error(`${task.id}/${arm}: duplicate or missing trial indexes`);
    }
    for (const record of taskRecords) {
      validateRecord(record, task, arm, manifest, requireActivation);
    }
  }
}

export function trialIndex(record) {
  if (Number.isInteger(record.trialIndex)) return record.trialIndex;
  const match = /::trial-(\d+)$/.exec(record.itemId ?? "");
  if (!match) throw new Error(`cannot parse trial index from '${record.itemId}'`);
  return Number(match[1]);
}

function validateRecord(record, task, arm, manifest, requireActivation) {
  const index = trialIndex(record);
  const label = `${task.id}/${arm}/trial-${index}`;
  if (record.variant !== arm || record.stimulus !== task.name || record.model !== manifest.model) {
    throw new Error(`${label}: variant, stimulus, or model mismatch`);
  }
  if (record.trajectory?.metadata?.model != null &&
      record.trajectory.metadata.model !== manifest.model) {
    throw new Error(`${label}: trajectory model mismatch`);
  }
  if (record.totalTrials != null && record.totalTrials !== manifest.k) {
    throw new Error(`${label}: totalTrials mismatch`);
  }
  if (record.evalName !== manifest.evalName ||
      path.basename(record.evalFilePath ?? "") !== manifest.evalFile ||
      !record.itemId) {
    throw new Error(`${label}: eval identity mismatch`);
  }
  const suffix = `::${arm}::${manifest.model}::${task.name}::trial-${index}`;
  if (!record.itemId.endsWith(suffix)) {
    throw new Error(`${label}: itemId identity mismatch`);
  }
  const expectedHash = manifest.evalHash.replace(/^sha256:/, "").slice(0, 16);
  if (!record.experiment ||
      record.experiment.evalHash !== expectedHash ||
      record.experiment.variant !== arm ||
      path.basename(record.experiment.evalFile ?? "") !== manifest.evalFile ||
      !/^[0-9a-f]{16}$/.test(record.experiment.configHash ?? "")) {
    throw new Error(`${label}: experiment provenance mismatch`);
  }
  if (record.status !== "success") {
    throw new Error(`${label}: execution status is ${record.status}`);
  }
  if (!(record.durationMs > 0)) {
    throw new Error(`${label}: invalid duration`);
  }
  const usage = record.trajectory?.metrics?.tokenUsage;
  if (!usage || [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens]
    .some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error(`${label}: invalid token metrics`);
  }
  if (requireActivation && record.trajectory?.metrics?.skillActivationBreakdown == null) {
    throw new Error(`${label}: missing skill activation breakdown`);
  }
  validateGraders(record, task, label);
}

function validateGraders(record, task, label) {
  const details = record.gradeResult?.details;
  if (!Array.isArray(details)) {
    throw new Error(`${label}: missing grader details`);
  }
  const expected = new Map(task.graders.map((grader) => [grader.name, grader.type]));
  const actual = new Map();
  for (const grader of details) {
    if (!grader.name || actual.has(grader.name) || typeof grader.passed !== "boolean") {
      throw new Error(`${label}: missing or duplicate grader name`);
    }
    actual.set(grader.name, grader.graderType);
  }
  if (actual.size !== expected.size) {
    throw new Error(`${label}: grader count mismatch`);
  }
  for (const [name, type] of expected) {
    if (actual.get(name) !== type) {
      throw new Error(`${label}: grader '${name}' missing or type-mismatched`);
    }
  }
  const failedHarness = details.find(
    (grader) => grader.name.startsWith("harness/") && grader.passed !== true
  );
  if (failedHarness) {
    throw new Error(`${label}: harness grader '${failedHarness.name}' failed`);
  }
}
