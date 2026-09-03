import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { childEnvironment } from "./isolation.mjs";
import { readTrials, trialIndex, validateArm } from "./vally-validation.mjs";

export async function canonicalizeRun({
  root,
  runRoot,
  model,
  manifest,
  sourceDirectory,
  isolation,
  pinsHash,
}) {
  const source = {};
  const affected = [];
  for (const arm of ["baseline", "grounded"]) {
    source[arm] = await readTrials(path.join(sourceDirectory, arm, "results.jsonl"));
    validateSourceIdentity(source[arm], arm, model.id, manifest);
    for (const task of manifest.tasks) {
      const records = source[arm].filter((record) => record.stimulus === task.name);
      if (needsRepair(records, task, manifest.k)) {
        affected.push({ arm, task });
      }
    }
  }

  const repaired = new Map();
  const repairRuns = [];
  for (const { arm, task } of affected) {
    const attemptRoot = await nextRepairDirectory(runRoot, model.id, task.id, arm);
    const args = [
      "eval",
      "--eval-spec", `generated/eval.${model.id}.yaml`,
      "--tag", `task-id=${task.id}`,
      "--runs", String(manifest.k),
      "--workers", "1",
      "--max-retries", "0",
      "--output-dir", attemptRoot
    ];
    if (arm === "grounded") {
      args.push("--skill-dir", "vendor/skills");
    }
    const result = spawnSync(path.join(root, "node_modules", ".bin", "vally"), args, {
      cwd: root,
      env: childEnvironment(isolation, { auth: true }),
      stdio: "inherit"
    });
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`${model.id}/${task.id}/${arm}: repair exited with ${result.status}`);
    }

    const directories = await resultDirectories(attemptRoot);
    if (directories.length !== 1) {
      throw new Error(`${model.id}/${task.id}/${arm}: expected one repair result directory`);
    }
    const repairDirectory = path.join(attemptRoot, directories[0]);
    const repairRun = path.relative(runRoot, repairDirectory);
    const direct = await readTrials(path.join(repairDirectory, "results.jsonl"));
    const canonical = direct.map((record) => canonicalize(record, arm, repairRun));
    const taskManifest = { ...manifest, tasks: [task] };
    validateArm(canonical, {
      arm,
      manifest: taskManifest,
      requireActivation: arm === "grounded"
    });
    repaired.set(`${arm}/${task.id}`, canonical);
    repairRuns.push({
      model: model.id,
      task: task.id,
      arm,
      runDirectory: repairRun,
      resultsHash: await hashFile(path.join(repairDirectory, "results.jsonl")),
      vallyExitCode: result.status
    });
  }

  const canonicalDirectory = path.join(runRoot, model.id, "run");
  await mkdir(path.join(canonicalDirectory, "baseline"), { recursive: true });
  await mkdir(path.join(canonicalDirectory, "grounded"), { recursive: true });
  for (const arm of ["baseline", "grounded"]) {
    const records = manifest.tasks.flatMap((task) =>
      repaired.get(`${arm}/${task.id}`) ??
      source[arm].filter((record) => record.stimulus === task.name)
    );
    const resultFile = path.join(canonicalDirectory, arm, "results.jsonl");
    await writeFile(resultFile, `${records.map(JSON.stringify).join("\n")}\n`);
    validateArm(records, {
      arm,
      manifest,
      requireActivation: arm === "grounded"
    });
  }

  if (affected.length === 0) {
    for (const name of ["eval-results.md", "otel-spans.jsonl"]) {
      try {
        await cp(path.join(sourceDirectory, name), path.join(canonicalDirectory, name));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return {
      sourceRunDirectory: path.relative(runRoot, sourceDirectory),
      repairedGroups: 0,
      repairManifestFile: null
    };
  }

  const repairManifest = {
    schema: 1,
    model: model.id,
    sourceRunDirectory: path.relative(runRoot, sourceDirectory),
    sourceBaselineHash: await hashFile(path.join(sourceDirectory, "baseline", "results.jsonl")),
    sourceGroundedHash: await hashFile(path.join(sourceDirectory, "grounded", "results.jsonl")),
    pinsHash,
    affectedGroups: affected.map(({ arm, task }) => ({ task: task.id, arm })),
    repairRuns,
    canonicalBaselineHash: await hashFile(
      path.join(canonicalDirectory, "baseline", "results.jsonl")
    ),
    canonicalGroundedHash: await hashFile(
      path.join(canonicalDirectory, "grounded", "results.jsonl")
    )
  };
  const repairManifestFile = path.join(runRoot, model.id, "repair-manifest.json");
  await writeFile(repairManifestFile, `${JSON.stringify(repairManifest, null, 2)}\n`);
  return {
    sourceRunDirectory: repairManifest.sourceRunDirectory,
    repairedGroups: affected.length,
    repairManifestFile: path.relative(runRoot, repairManifestFile)
  };
}

function validateSourceIdentity(records, arm, model, manifest) {
  for (const record of records) {
    if (record.variant !== arm || record.model !== model ||
        !manifest.byName.has(record.stimulus)) {
      throw new Error(`${model}/${arm}: source run contains foreign model, variant, or task`);
    }
  }
}

function needsRepair(records, task, k) {
  if (records.length !== k) return true;
  const indexes = records.map(trialIndex).sort((left, right) => left - right);
  if (indexes.some((value, index) => value !== index)) return true;
  return records.some((record) => {
    if (record.status !== "success") return true;
    const harness = record.gradeResult?.details?.find(
      (grader) => grader.name?.startsWith("harness/")
    );
    return harness?.passed !== true;
  });
}

function canonicalize(record, arm, repairRun) {
  const originalItemId = record.itemId;
  if (!originalItemId?.includes("::main::")) {
    throw new Error(`${record.stimulus}: repair record has no main variant itemId`);
  }
  return {
    ...record,
    variant: arm,
    itemId: originalItemId.replace("::main::", `::${arm}::`),
    repair: {
      sourceVariant: "main",
      originalItemId,
      repairRun
    }
  };
}

async function nextRepairDirectory(runRoot, model, task, arm) {
  const parent = path.join(runRoot, "repairs", model, task, arm);
  await mkdir(parent, { recursive: true });
  const attempts = await readdir(parent, { withFileTypes: true });
  const number = attempts.filter((entry) => entry.isDirectory()).length + 1;
  const directory = path.join(parent, `attempt-${number}`);
  await mkdir(directory);
  return directory;
}

async function resultDirectories(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function hashFile(file) {
  return `sha256:${createHash("sha256").update(await readFile(file)).digest("hex")}`;
}
