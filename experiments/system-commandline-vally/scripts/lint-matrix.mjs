import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
for (const model of pins.vally.models) {
  run(["lint", "--eval-spec", `generated/eval.${model.id}.yaml`]);
  run(["experiment", "run", `generated/experiment.${model.id}.yaml`, "--dry-run"]);
}

function run(args) {
  const result = spawnSync(path.join(root, "node_modules", ".bin", "vally"), args, {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`vally ${args.join(" ")} failed with exit code ${result.status}`);
  }
}
