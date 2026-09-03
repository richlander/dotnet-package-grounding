import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runDirectory = process.argv[2];
if (!runDirectory) {
  console.error("usage: npm run analyze -- <vally experiment run directory> [grounding options]");
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const experiment = path.join(root, "experiments/markout-vally-prototype");
const run = path.resolve(runDirectory);
const forwarded = process.argv.slice(3);
if (!forwarded.some((argument) =>
  argument === "--grader-manifest" || argument.startsWith("--grader-manifest="))) {
  const records = readFileSync(path.join(run, "baseline", "results.jsonl"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse)
    .filter((record) => record.type === "trial-result");
  const manifest = new Set(records.map((record) => record.stimulus)).size > 3
    ? "grader-manifest.ct24.json"
    : "grader-manifest.prototype.json";
  forwarded.push("--grader-manifest", path.join(experiment, manifest));
}
const result = spawnSync(
  path.join(root, "eng/grounding"),
  ["vally", "task-card", run, ...forwarded],
  { cwd: root, stdio: "inherit" }
);
process.exit(result.status ?? 1);
