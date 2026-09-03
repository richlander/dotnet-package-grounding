import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(root, "../..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
const outputRoot = path.join(root, ".cache", "matrix-smoke");
const taskIds = ["C01", "C13", "C20"];
await rm(outputRoot, { recursive: true, force: true });

for (const model of pins.vally.models) {
  const isolation = await prepareIsolation();
  try {
    const manifest = JSON.parse(
      await readFile(path.join(root, "generated", `grader-manifest.${model.id}.json`), "utf8")
    );
    const smokeManifest = {
      ...manifest,
      synthetic: true,
      k: 1,
      tasks: manifest.tasks.filter((task) => taskIds.includes(task.id))
    };
    const modelRoot = path.join(outputRoot, model.id);
    const paired = path.join(modelRoot, "paired");
    await mkdir(path.join(paired, "baseline"), { recursive: true });
    await mkdir(path.join(paired, "grounded"), { recursive: true });
    const records = { baseline: [], grounded: [] };

    for (const taskId of taskIds) {
      for (const arm of ["baseline", "grounded"]) {
        const output = path.join(modelRoot, taskId, arm);
        const args = [
          "eval",
          "--eval-spec", `generated/eval.${model.id}.yaml`,
          "--tag", `task-id=${taskId}`,
          "--runs", "1",
          "--workers", "1",
          "--max-retries", "0",
          "--output-dir", output
        ];
        if (arm === "grounded") {
          args.push("--skill-dir", "vendor/skills");
        }
        run(args, isolation);
        const record = await readTrial(output);
        validateTelemetry(record, model.id, arm);
        records[arm].push(canonicalize(record, arm));
      }
    }

    const manifestPath = path.join(modelRoot, "grader-manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(smokeManifest, null, 2)}\n`);
    for (const arm of ["baseline", "grounded"]) {
      await writeFile(
        path.join(paired, arm, "results.jsonl"),
        `${records[arm].map(JSON.stringify).join("\n")}\n`
      );
    }
    const result = spawnSync(
      path.join(repositoryRoot, "eng", "grounding"),
      [
        "vally", "task-card", paired,
        "--grader-manifest", manifestPath,
        "--runs", "1",
        "--model", model.id,
        "--iet-model", "openai",
        "--no-title"
      ],
      { cwd: repositoryRoot, stdio: "inherit" }
    );
    if (result.status !== 0) {
      throw new Error(`${model.id}: grounding Vally adapter failed with ${result.status}`);
    }
  } finally {
    await isolation.dispose();
  }
}

function run(args, isolation) {
  const result = spawnSync(path.join(root, "node_modules", ".bin", "vally"), args, {
    cwd: root,
    env: childEnvironment(isolation, { auth: true }),
    stdio: "inherit"
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`vally ${args[0]} failed with exit code ${result.status}`);
  }
}

async function readTrial(directory) {
  const timestamps = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (timestamps.length !== 1) {
    throw new Error(`${directory}: expected one timestamped result directory`);
  }
  const records = (await readFile(
    path.join(directory, timestamps[0], "results.jsonl"),
    "utf8"
  ))
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse)
    .filter((record) => record.type === "trial-result");
  if (records.length !== 1) {
    throw new Error(`${directory}: expected one trial-result, found ${records.length}`);
  }
  return records[0];
}

function validateTelemetry(record, model, arm) {
  if (record.model !== model || record.status !== "success" || !(record.durationMs > 0)) {
    throw new Error(`${model}/${arm}/${record.stimulus}: invalid identity or execution status`);
  }
  const usage = record.trajectory?.metrics?.tokenUsage;
  if (!usage || [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens]
    .some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error(`${model}/${arm}/${record.stimulus}: invalid GPT-5.6 token telemetry`);
  }
  if (arm === "grounded" &&
      record.trajectory?.metrics?.skillActivationBreakdown == null) {
    throw new Error(`${model}/${arm}/${record.stimulus}: missing activation telemetry`);
  }
}

function canonicalize(record, variant) {
  const itemId = record.itemId?.replace("::main::", `::${variant}::`);
  return { ...record, variant, ...(itemId ? { itemId } : {}) };
}
