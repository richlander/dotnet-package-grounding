import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";
import {
  readManifest,
  readTrials,
  validateArm,
  validateManifestPins,
} from "./vally-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isolation = await prepareIsolation();
const requestedSpec = process.argv[2]?.endsWith(".yaml") ? process.argv[2] : "experiment.yaml";
const forwardedArgs = requestedSpec === "experiment.yaml" ? process.argv.slice(2) : process.argv.slice(3);
const outputRoot = path.join(root, "results");
const priorOutputs = new Set(await resultDirectories(outputRoot));

try {
  const args = [
    "experiment",
    "run",
    requestedSpec,
    "--output-dir",
    "results",
    ...forwardedArgs
  ];
  const child = spawn(path.join(root, "node_modules", ".bin", "vally"), args, {
    cwd: root,
    env: childEnvironment(isolation, { auth: true }),
    stdio: "inherit"
  });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if ((code === 0 || code === 1) && requestedSpec === "experiment.ct24.yaml") {
    const created = (await resultDirectories(outputRoot)).filter((directory) => !priorOutputs.has(directory));
    if (created.length === 1 && await completeCt24Run(path.join(outputRoot, created[0]))) {
      if (code === 1) {
        console.error("Vally aggregate threshold failed, but all 240 CT-24 trial artifacts completed; grounding analysis is authoritative.");
      }
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  } else {
    process.exitCode = code ?? 1;
  }
} finally {
  await isolation.dispose();
}

async function resultDirectories(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function completeCt24Run(directory) {
  try {
    const manifest = await readManifest(path.join(root, "grader-manifest.ct24.json"));
    const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
    validateManifestPins(manifest, pins.ct24);
    for (const arm of ["baseline", "grounded"]) {
      const records = await readTrials(path.join(directory, arm, "results.jsonl"));
      validateArm(records, {
        arm,
        manifest,
        requireActivation: arm === "grounded",
      });
    }
    return true;
  } catch (error) {
    console.error(`incomplete CT-24 run: ${error.message}`);
    return false;
  }
}
