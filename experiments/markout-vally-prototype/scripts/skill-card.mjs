import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runDirectory = process.argv[2];
if (!runDirectory) {
  console.error("usage: npm run skill-card -- <complete CT-24 Vally run directory> [grounding options]");
  process.exit(2);
}

const experiment = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(experiment, "../..");
const result = spawnSync(
  path.join(root, "eng/grounding"),
  [
    "vally",
    "skill-card",
    path.resolve(runDirectory),
    path.join(experiment, "applicability.markout-ct24.json"),
    "--grader-manifest",
    path.join(experiment, "grader-manifest.ct24.json"),
    ...process.argv.slice(3)
  ],
  { cwd: root, stdio: "inherit" }
);
process.exit(result.status ?? 1);
