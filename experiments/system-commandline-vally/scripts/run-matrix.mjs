import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeMatrix } from "./analyze-matrix.mjs";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";
import { readManifest, readTrials, validateArm } from "./vally-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
const dryRun = process.argv.includes("--dry-run");

verifyInputs();
if (dryRun) {
  for (const model of pins.vally.models) {
    runSync([
      "experiment", "run",
      `generated/experiment.${model.id}.yaml`,
      "--dry-run"
    ]);
  }
  process.exit(0);
}

const matrixId = new Date().toISOString().replace(/[:.]/g, "-");
const runRoot = path.join(root, "results", matrixId);
await mkdir(runRoot, { recursive: true });
const matrix = {
  schema: 1,
  status: "incomplete",
  matrixRunId: matrixId,
  createdAt: new Date().toISOString(),
  suite: "System.CommandLine CT-24",
  packageVersion: pins.systemCommandLine.packageVersion,
  sourceCommit: pins.source.commit,
  k: pins.matrix.k,
  vallyVersion: pins.vally.packageVersion,
  vallyCommit: pins.vally.sourceCommit,
  judgeModel: pins.vally.judgeModel,
  judgeReasoningEffort: pins.vally.judgeReasoningEffort,
  pinsHash: await hashFile(path.join(root, "pins.json")),
  applicabilityHash: await hashFile(
    path.join(root, "applicability.system-commandline-ct24.json")
  ),
  models: []
};
await writeMatrix();

try {
  for (const model of pins.vally.models) {
    const isolation = await prepareIsolation();
    try {
      const outputParent = path.join(runRoot, model.id);
      await mkdir(outputParent, { recursive: true });
      const code = await run([
        "experiment", "run",
        `generated/experiment.${model.id}.yaml`,
        "--output-dir", outputParent
      ], isolation);
      if (code !== 0 && code !== 1) {
        throw new Error(`${model.id}: Vally exited with ${code}`);
      }

      const directories = await resultDirectories(outputParent);
      if (directories.length !== 1) {
        throw new Error(`${model.id}: expected one result directory, found ${directories.length}`);
      }
      const canonical = path.join(outputParent, "run");
      await rename(path.join(outputParent, directories[0]), canonical);
      const manifestFile = `grader-manifest.${model.id}.json`;
      const manifest = await readManifest(path.join(root, "generated", manifestFile));
      const modelPins = pins.matrix.models[model.id];
      if (manifest.model !== model.id ||
          manifest.hash !== modelPins.graderManifestHash ||
          manifest.evalHash !== modelPins.evalHash) {
        throw new Error(`${model.id}: manifest provenance mismatch`);
      }

      for (const arm of ["baseline", "grounded"]) {
        const records = await readTrials(path.join(canonical, arm, "results.jsonl"));
        validateArm(records, {
          arm,
          manifest,
          requireActivation: arm === "grounded"
        });
      }

      matrix.models.push({
        model: model.id,
        role: model.role,
        reasoningEffort: model.reasoningEffort,
        evalFile: `eval.${model.id}.yaml`,
        evalHash: modelPins.evalHash,
        graderManifestFile: manifestFile,
        graderManifestHash: modelPins.graderManifestHash,
        runDirectory: `${model.id}/run`,
        baselineHash: await hashFile(path.join(canonical, "baseline", "results.jsonl")),
        groundedHash: await hashFile(path.join(canonical, "grounded", "results.jsonl")),
        trialsPerArm: manifest.tasks.length * manifest.k,
        vallyExitCode: code
      });
      await writeMatrix();
    } finally {
      await isolation.dispose();
    }
  }

  verifyInputs();
  matrix.status = "complete";
  matrix.completedAt = new Date().toISOString();
  await writeMatrix();
  const index = await analyzeMatrix(runRoot);
  console.log(`matrix complete: ${runRoot}`);
  console.log(`cards: ${index}`);
} catch (error) {
  matrix.error = error.message;
  await writeMatrix();
  throw error;
}

async function writeMatrix() {
  await writeFile(
    path.join(runRoot, "matrix-manifest.json"),
    `${JSON.stringify(matrix, null, 2)}\n`
  );
}

function verifyInputs() {
  const result = spawnSync(process.execPath, ["scripts/materialize-inputs.mjs"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`input verification failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function runSync(args) {
  const result = spawnSync(path.join(root, "node_modules", ".bin", "vally"), args, {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`vally ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function run(args, isolation) {
  const child = spawn(path.join(root, "node_modules", ".bin", "vally"), args, {
    cwd: root,
    env: childEnvironment(isolation, { auth: true }),
    stdio: "inherit"
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function resultDirectories(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== "run")
    .map((entry) => entry.name);
}

async function hashFile(file) {
  return `sha256:${createHash("sha256").update(await readFile(file)).digest("hex")}`;
}
