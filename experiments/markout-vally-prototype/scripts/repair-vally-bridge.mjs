import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";
import {
  readManifest,
  readTrials,
  sha256File,
  taskId,
  trialIndex,
  validateArm,
  validateManifestPins,
} from "./vally-validation.mjs";

const sourceRun = process.argv[2];
const reuse = process.argv.includes("--reuse");
if (!sourceRun) {
  console.error("usage: node scripts/repair-vally-bridge.mjs <incomplete experiment run directory>");
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(sourceRun);
const manifestPath = path.join(root, "grader-manifest.ct24.json");
const manifest = await readManifest(manifestPath);
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
validateManifestPins(manifest, pins.ct24);
const executionInputs = await verifiedExecutionInputs();
const sourceBaselinePath = path.join(source, "baseline", "results.jsonl");
const sourceGroundedPath = path.join(source, "grounded", "results.jsonl");
const sourceBaseline = await readTrials(sourceBaselinePath);
const sourceGrounded = await readTrials(sourceGroundedPath);
validateArm(sourceBaseline, {
  arm: "baseline",
  manifest,
  allowExecutionErrors: true,
});
validateArm(sourceGrounded, {
  arm: "grounded",
  manifest,
  allowExecutionErrors: true,
  requireActivation: true,
});
const sourceByArm = { baseline: sourceBaseline, grounded: sourceGrounded };
const affectedTasks = Object.fromEntries(["baseline", "grounded"].map((arm) => [
  arm,
  [...new Set(
    sourceByArm[arm]
      .filter((record) => record.status !== "success")
      .map((record) => taskId(record.stimulus))
  )].sort(),
]));

if (affectedTasks.baseline.length === 0 && affectedTasks.grounded.length === 0) {
  throw new Error("source run has no failed executions to repair");
}
const repairRoot = path.join(root, "bridge-results", "vally-repair");
if (!reuse) {
  await rm(repairRoot, { recursive: true, force: true });
  const isolation = await prepareIsolation();
  try {
    for (const arm of ["baseline", "grounded"]) {
      if (affectedTasks[arm].length > 0) {
        assertExecutionInputs(executionInputs, await verifiedExecutionInputs());
        await runRepair(arm, affectedTasks[arm], isolation);
        assertExecutionInputs(executionInputs, await verifiedExecutionInputs());
      }
    }
  } finally {
    await isolation.dispose();
  }
}

const repairByArm = {};
let retryIsolation;
try {
  for (const arm of ["baseline", "grounded"]) {
    if (affectedTasks[arm].length === 0) continue;
    const repairRun = await findRepairRun(path.join(repairRoot, arm));
    const resultsPath = path.join(repairRun, "results.jsonl");
    let replacements = (await readTrials(resultsPath))
      .map((record) => ({ ...record, __repairRun: repairRun }));
    const repairRuns = [repairRun];
    const resultsPaths = [resultsPath];

    for (let attempt = 1; attempt <= 3; attempt++) {
      const invalid = invalidRepairTasks(
        replacements,
        arm,
        affectedTasks[arm]
      );
      if (invalid.length === 0) break;
      if (attempt === 3) {
        throw new Error(`${arm} repair still has invalid task groups after three attempts: ${invalid.join(", ")}`);
      }
      const retryRoot = path.join(repairRoot, `${arm}-retry-${attempt}`);
      let retryRun = null;
      if (reuse) {
        try {
          retryRun = await findRepairRun(retryRoot);
        } catch {
          retryRun = null;
        }
      }
      if (retryRun === null) {
        retryIsolation ??= await prepareIsolation();
        assertExecutionInputs(executionInputs, await verifiedExecutionInputs());
        await rm(retryRoot, { recursive: true, force: true });
        await runRepair(arm, invalid, retryIsolation, retryRoot);
        assertExecutionInputs(executionInputs, await verifiedExecutionInputs());
        retryRun = await findRepairRun(retryRoot);
      }
      const retryResultsPath = path.join(retryRun, "results.jsonl");
      const retryRecords = (await readTrials(retryResultsPath))
        .map((record) => ({ ...record, __repairRun: retryRun }));
      const invalidSet = new Set(invalid);
      replacements = [
        ...replacements.filter((record) => !invalidSet.has(taskId(record.stimulus))),
        ...retryRecords,
      ];
      repairRuns.push(retryRun);
      resultsPaths.push(retryResultsPath);
    }

    validateArm(replacements, {
      arm: "main",
      manifest,
      expectedTaskIds: affectedTasks[arm],
      allowDirectEval: true,
      requireActivation: arm === "grounded",
    });
    repairByArm[arm] = { repairRuns, resultsPaths, replacements };
  }
} finally {
  await retryIsolation?.dispose();
}

const canonical = path.join(root, "bridge-results", "vally");
await rm(canonical, { recursive: true, force: true });
await mkdir(path.join(canonical, "baseline"), { recursive: true });
await mkdir(path.join(canonical, "grounded"), { recursive: true });

const replacementMappings = [];
const canonicalByArm = {};
for (const arm of ["baseline", "grounded"]) {
  const affected = new Set(affectedTasks[arm]);
  const retained = sourceByArm[arm].filter((record) => !affected.has(taskId(record.stimulus)));
  const canonicalReplacements = (repairByArm[arm]?.replacements ?? []).map((record) =>
    canonicalizeReplacement(record, arm, repairByArm[arm].repairRuns, replacementMappings)
  );
  canonicalByArm[arm] = [...retained, ...canonicalReplacements].sort(compareTrial);
}
const baseline = canonicalByArm.baseline;
const grounded = canonicalByArm.grounded;
validateArm(baseline, { arm: "baseline", manifest });
validateArm(grounded, { arm: "grounded", manifest, requireActivation: true });

const canonicalBaselinePath = path.join(canonical, "baseline", "results.jsonl");
const canonicalGroundedPath = path.join(canonical, "grounded", "results.jsonl");
await writeJsonl(canonicalBaselinePath, baseline);
await writeJsonl(canonicalGroundedPath, grounded);
await writeFile(path.join(canonical, "repair-manifest.json"), JSON.stringify({
  schema: 1,
  policy: "Replace all five trials for every task containing an execution-error record; never replace selected outcomes.",
  sourceRun: source,
  graderManifest: {
    path: manifestPath,
    hash: manifest.hash,
    evalHash: manifest.evalHash,
  },
  executionInputs,
  files: {
    source: {
      baseline: { path: sourceBaselinePath, hash: await sha256File(sourceBaselinePath) },
      grounded: { path: sourceGroundedPath, hash: await sha256File(sourceGroundedPath) },
    },
    repairs: Object.fromEntries(await Promise.all(
      Object.entries(repairByArm).map(async ([arm, repair]) => [
        arm,
        await Promise.all(repair.resultsPaths.map(async (file) => ({
          path: file,
          hash: await sha256File(file),
        }))),
      ])
    )),
    canonicalBaseline: { path: canonicalBaselinePath, hash: await sha256File(canonicalBaselinePath) },
    canonicalGrounded: { path: canonicalGroundedPath, hash: await sha256File(canonicalGroundedPath) },
  },
  affectedTasks,
  replacements: replacementMappings,
  replacedSourceRecords: Object.fromEntries(["baseline", "grounded"].map((arm) => {
    const affected = new Set(affectedTasks[arm]);
    return [arm, sourceByArm[arm]
      .filter((record) => affected.has(taskId(record.stimulus)))
      .map((record) => ({ itemId: record.itemId, status: record.status, error: record.error ?? null }))];
  })),
}, null, 2));
console.log(`canonical Vally bridge: ${canonical}`);

async function runRepair(arm, tasks, isolation, outputDirectory = path.join(repairRoot, arm)) {
  const args = [
    "eval",
    "--eval-spec", "eval.ct24.yaml",
    "--tag", `task-id=${tasks.join(",")}`,
    "--runs", "5",
    "--workers", "1",
    "--output-dir", outputDirectory,
  ];
  if (arm === "grounded") args.push("--skill-dir", "vendor/skills");
  const child = spawn(path.join(root, "node_modules", ".bin", "vally"), args, {
    cwd: root,
    env: childEnvironment(isolation, { auth: true }),
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (code !== 0 && code !== 1) throw new Error(`${arm} repair eval exited ${code}`);
}

async function findRepairRun(directory) {
  const repairDirectories = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (repairDirectories.length !== 1) {
    throw new Error(`${directory}: expected one repair result directory, found ${repairDirectories.length}`);
  }
  return path.join(directory, repairDirectories[0]);
}

function canonicalizeReplacement(record, arm, repairRuns, mappings) {
  const { __repairRun, ...wireRecord } = record;
  const canonicalItemId = canonicalIdentity(record.itemId, "main", arm);
  const canonicalShardKey = record.shardKey
    ? canonicalIdentity(record.shardKey, "main", arm)
    : record.shardKey;
  mappings.push({
    arm,
    originalItemId: record.itemId,
    canonicalItemId,
  });
  return {
    ...wireRecord,
    variant: arm,
    itemId: canonicalItemId,
    ...(canonicalShardKey ? { shardKey: canonicalShardKey } : {}),
    repair: {
      sourceVariant: "main",
      originalItemId: record.itemId,
      repairRun: __repairRun ?? repairRuns.join(","),
    },
  };
}

function invalidRepairTasks(records, arm, tasks) {
  const invalid = [];
  for (const id of tasks) {
    try {
      validateArm(records.filter((record) => taskId(record.stimulus) === id), {
        arm: "main",
        manifest,
        expectedTaskIds: [id],
        allowDirectEval: true,
        requireActivation: arm === "grounded",
      });
    } catch {
      invalid.push(id);
    }
  }
  return invalid;
}

function compareTrial(left, right) {
  return taskId(left.stimulus).localeCompare(taskId(right.stimulus)) ||
    trialIndex(left) - trialIndex(right);
}

async function writeJsonl(file, records) {
  await writeFile(file, `${records.map(JSON.stringify).join("\n")}\n`);
}

function canonicalIdentity(value, fromVariant, toVariant) {
  const marker = `::${fromVariant}::`;
  if (!value?.includes(marker)) {
    throw new Error(`repair identity '${value}' does not contain ${marker}`);
  }
  return value.replace(marker, `::${toVariant}::`);
}

async function verifiedExecutionInputs() {
  const evalHash = await sha256File(path.join(root, "eval.ct24.yaml"));
  const globalJsonHash = await sha256File(path.join(root, "global.json"));
  const fixtureHash = await hashFiles(
    path.join(root, "vendor"),
    Array.from({ length: 24 }, (_, index) => {
      const id = `ct${String(index + 1).padStart(2, "0")}`;
      return [`fixtures/${id}/Program.cs`, `fixtures/${id}/Report.csproj`];
    }).flat()
  );
  const shelfHash = await hashFiles(
    path.join(root, "vendor"),
    [
      "skills/markout/SKILL.md",
      "skills/markout-built-in-shapes/SKILL.md",
      "skills/markout-conditional-composition/SKILL.md",
      "skills/markout-output-formats/SKILL.md",
      "skills/markout-composite-cells-cards/SKILL.md",
      "skills/plugin.json",
    ]
  );
  if (evalHash !== pins.ct24.vallyEvalHash ||
      fixtureHash !== pins.ct24.fixtureHash ||
      shelfHash !== pins.shelf.hash) {
    throw new Error("repair execution inputs do not match pins.json");
  }
  return { evalHash, globalJsonHash, fixtureHash, shelfHash };
}

function assertExecutionInputs(expected, actual) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("repair execution inputs changed during collection");
  }
}

async function hashFiles(base, files) {
  const hash = createHash("sha256");
  for (const relative of [...files].sort()) {
    hash.update(relative);
    hash.update("\0");
    hash.update(await readFile(path.join(base, relative)));
  }
  return `sha256:${hash.digest("hex")}`;
}
