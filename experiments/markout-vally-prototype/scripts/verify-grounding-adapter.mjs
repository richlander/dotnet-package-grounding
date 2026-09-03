import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const testdata = path.join(root, "experiments/markout-vally-prototype/testdata");
const run = path.join(testdata, "vally-run");
const graderManifest = path.join(testdata, "grader-manifest.json");
const output = execFileSync(
  "dotnet",
  [
    path.join(root, "src/grounding/bin/Release/net11.0/grounding.dll"),
    "vally", "task-card", run,
    "--grader-manifest", graderManifest,
    "--runs", "2",
    "--model", "claude-haiku-4.5"
  ],
  { cwd: root, encoding: "utf8" }
);

assert.match(output, /\| CT-both \| both productive \| 1\/2 → 2\/2 \(\+0\.500\) \|/);
assert.match(output, /\| CT-grounded-only \| grounded-only \| 0\/2 → 2\/2 \(\+1\.000\) \| \+1\.000 \|/);
assert.match(output, /median-IET ×0\.95; levelized-IET ×0\.49; median-duration ×0\.85/);

const skillOutput = execFileSync(
  "dotnet",
  [
    path.join(root, "src/grounding/bin/Release/net11.0/grounding.dll"),
    "vally", "skill-card", run,
    path.join(testdata, "applicability.json"),
    "--grader-manifest", graderManifest,
    "--runs", "2",
    "--model", "claude-haiku-4.5",
    "--skill", "markout-output-formats"
  ],
  { cwd: root, encoding: "utf8" }
);

for (const measure of ["Retrieval", "Coverage", "Reliability", "Fidelity", "Do no harm", "Efficiency"])
  assert.match(skillOutput, new RegExp(`\\| ${measure} \\|`));
assert.match(skillOutput, /target pulls 1\/2 \(50\.0%\); off-target pulls 1\/2 \(50\.0%\)/);
assert.match(skillOutput, /1\/2 → 2\/2 \(\+0\.500\)/);
assert.match(skillOutput, /Total-IET ×0\.95 across 1 shared tasks; levelized geo ×0\.49; duration geo ×0\.85/);
assert.match(skillOutput, /### Shelf reference card/);
assert.match(skillOutput, /### Skill quality card — `markout-output-formats`/);

const incomplete = spawnSync(
  "dotnet",
  [
    path.join(root, "src/grounding/bin/Release/net11.0/grounding.dll"),
    "vally", "skill-card", run,
    path.join(testdata, "applicability-incomplete.json"),
    "--grader-manifest", graderManifest,
    "--runs", "2",
    "--model", "claude-haiku-4.5"
  ],
  { cwd: root, encoding: "utf8" }
);
assert.equal(incomplete.status, 1);
assert.match(incomplete.stderr, /run is not the complete registered suite; missing: CT-missing/);

const negativeRoot = path.join(testdata, ".omitted-delivers-grader");
rmSync(negativeRoot, { recursive: true, force: true });
try {
  mkdirSync(negativeRoot, { recursive: true });
  cpSync(run, path.join(negativeRoot, "run"), { recursive: true });
  const negativeManifest = JSON.parse(readFileSync(graderManifest, "utf8"));
  negativeManifest.tasks.find((task) => task.name === "CT-both").graders.push({
    name: "delivers/required-secondary",
    type: "run-command"
  });
  const negativeManifestPath = path.join(negativeRoot, "grader-manifest.json");
  writeFileSync(negativeManifestPath, `${JSON.stringify(negativeManifest, null, 2)}\n`);

  for (const arm of ["baseline", "grounded"]) {
    const resultPath = path.join(negativeRoot, "run", arm, "results.jsonl");
    const records = readFileSync(resultPath, "utf8").trim().split(/\r?\n/).map(JSON.parse);
    for (const record of records) {
      if (record.stimulus !== "CT-both") continue;
      if (arm === "baseline" && record.trialIndex === 0) {
        record.gradeResult.passed = false;
      } else {
        record.gradeResult.details.push({
          name: "delivers/required-secondary",
          graderType: "run-command",
          passed: true
        });
      }
    }
    writeFileSync(resultPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  }

  const omittedDelivers = spawnSync(
    "dotnet",
    [
      path.join(root, "src/grounding/bin/Release/net11.0/grounding.dll"),
      "vally", "task-card", path.join(negativeRoot, "run"),
      "--grader-manifest", negativeManifestPath
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(omittedDelivers.status, 1);
  assert.match(omittedDelivers.stderr, /CT-both\/baseline\/trial-0: grader count mismatch/);
} finally {
  rmSync(negativeRoot, { recursive: true, force: true });
}

console.log("grounding Vally adapter fixture: passed");
