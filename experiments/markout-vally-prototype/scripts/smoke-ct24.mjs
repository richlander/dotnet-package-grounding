import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(root, "../..");
const outputRoot = path.join(root, ".cache", "ct24-smoke");
await rm(outputRoot, { recursive: true, force: true });
const isolation = await prepareIsolation();

try {
  const common = [
    "eval",
    "--eval-spec", "eval.ct24.yaml",
    "--tag", "task-id=CT01",
    "--runs", "1",
    "--workers", "1",
    "--max-retries", "0"
  ];
  run([...common, "--output-dir", path.join(outputRoot, "baseline")], isolation);
  run([
    ...common,
    "--skill-dir", "vendor/skills",
    "--output-dir", path.join(outputRoot, "grounded")
  ], isolation);

  const baseline = await readTrial(path.join(outputRoot, "baseline"));
  const grounded = await readTrial(path.join(outputRoot, "grounded"));
  if (baseline.stimulus?.slice(0, 4) !== "CT01" || grounded.stimulus?.slice(0, 4) !== "CT01") {
    throw new Error("smoke output did not contain CT01 trial results");
  }
  if (grounded.trajectory?.metrics?.skillActivationBreakdown === undefined) {
    throw new Error("grounded smoke result has no skillActivationBreakdown");
  }
  const paired = path.join(outputRoot, "paired");
  const graderManifest = JSON.parse(await readFile(path.join(root, "grader-manifest.ct24.json"), "utf8"));
  const smokeManifest = {
    ...graderManifest,
    synthetic: true,
    k: 1,
    tasks: graderManifest.tasks.filter((task) => task.id === "CT01"),
  };
  const smokeManifestPath = path.join(outputRoot, "grader-manifest.json");
  await writeFile(smokeManifestPath, `${JSON.stringify(smokeManifest, null, 2)}\n`);
  await mkdir(path.join(paired, "baseline"), { recursive: true });
  await mkdir(path.join(paired, "grounded"), { recursive: true });
  await writeFile(
    path.join(paired, "baseline", "results.jsonl"),
    `${JSON.stringify(canonicalize(baseline, "baseline"))}\n`
  );
  await writeFile(
    path.join(paired, "grounded", "results.jsonl"),
    `${JSON.stringify(canonicalize(grounded, "grounded"))}\n`
  );
  const adapter = spawnSync(
    path.join(repositoryRoot, "eng", "grounding"),
    [
      "vally", "task-card", paired,
      "--grader-manifest", smokeManifestPath,
      "--runs", "1",
      "--model", "claude-haiku-4.5",
      "--no-title"
    ],
    { cwd: repositoryRoot, stdio: "inherit" }
  );
  if (adapter.status !== 0) {
    throw new Error(`grounding Vally adapter failed with exit code ${adapter.status}`);
  }
  console.log(JSON.stringify({
    baseline: { status: baseline.status, model: baseline.model },
    grounded: {
      status: grounded.status,
      model: grounded.model,
      skillActivationBreakdown: grounded.trajectory.metrics.skillActivationBreakdown
    }
  }, null, 2));
} finally {
  await isolation.dispose();
}

function run(args, isolation) {
  const result = spawnSync(path.join(root, "node_modules", ".bin", "vally"), args, {
    cwd: root,
    env: childEnvironment(isolation, { auth: true }),
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"]
  });
  if (result.status !== 0) {
    throw new Error(`vally ${args[0]} failed with exit code ${result.status}`);
  }
}

async function readTrial(directory) {
  const timestamps = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (timestamps.length !== 1)
    throw new Error(`${directory}: expected one timestamped result directory`);
  const lines = (await readFile(path.join(directory, timestamps[0], "results.jsonl"), "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse)
    .filter((record) => record.type === "trial-result");
  if (lines.length !== 1)
    throw new Error(`${directory}: expected one trial-result, found ${lines.length}`);
  return lines[0];
}

function canonicalize(record, variant) {
  const itemId = record.itemId?.replace("::main::", `::${variant}::`);
  return { ...record, variant, ...(itemId ? { itemId } : {}) };
}
