import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const infraRoot = path.resolve(experimentRoot, "../..");
const sourceRoot = path.join(experimentRoot, ".cache", "bridge", "source-markout-e744d7b");
const markoutRoot = path.join(experimentRoot, ".cache", "bridge", "run-markout-e744d7b-sdk10");
const smoke = process.argv.includes("--smoke");
const output = smoke
  ? path.join(experimentRoot, ".cache", "bridge", "custom-smoke")
  : path.join(experimentRoot, "bridge-results", "custom");
const pins = JSON.parse(await readFile(path.join(experimentRoot, "pins.json"), "utf8"));
const grounding = path.join(
  infraRoot,
  "src", "grounding", "bin", "Release", "net11.0", "osx-arm64", "publish", "grounding"
);
await prepareMarkoutSnapshot();
const overlayEvalHash = await prepareBridgeOverlay();
if (process.argv.includes("--prepare-only")) {
  console.log(JSON.stringify({ sourceCommit: pins.markout.sourceCommit, overlayEvalHash }, null, 2));
  process.exit(0);
}
const isolation = await prepareIsolation();

try {
  const args = [
    "run",
    "markout",
    "--root", markoutRoot,
    "--source", "skill",
    "--eval-mode", "holistic",
    "--package-baseline", "doc-stripped",
    "--runs", smoke ? "1" : "5",
    "--model", "claude-haiku-4.5",
    "--judge-model", "claude-haiku-4.5",
    "--fresh",
    "--out", output,
  ];
  if (smoke) args.push("--scenarios", "CT01");
  const child = spawn(grounding, args, {
    cwd: infraRoot,
    env: childEnvironment(isolation, { auth: true }),
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (code === 0 && !smoke) {
    const resultPath = path.join(output, "markout-skill-doc-stripped.haiku.json");
    const result = JSON.parse(await readFile(resultPath, "utf8"));
    result.bridgeProvenance = {
      markoutSourceCommit: pins.markout.sourceCommit,
      sourceEvalHash: pins.ct24.sourceEvalHash,
      sdkVersion: pins.dotnet.sdkVersion,
      overlayEvalHash,
      skillValidatorCommit: pins.customBridge.skillValidatorCommit,
      copilotCliVersion: pins.customBridge.copilotCliVersion,
    };
    await writeFile(resultPath, `${JSON.stringify(result)}\n`);
  }
  process.exitCode = code ?? 1;
} finally {
  await isolation.dispose();
}

async function prepareMarkoutSnapshot() {
  let rootExists = false;
  try {
    rootExists = (await stat(sourceRoot)).isDirectory();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!rootExists) {
    await mkdir(path.dirname(sourceRoot), { recursive: true });
    runGit(["clone", "--quiet", "--filter=blob:none", "https://github.com/richlander/markout.git", sourceRoot]);
    runGit(["-C", sourceRoot, "switch", "--detach", "--quiet", pins.markout.sourceCommit]);
  } else {
    try {
      if (!(await stat(path.join(sourceRoot, ".git"))).isDirectory()) {
        throw new Error(`${sourceRoot} exists but is not a Git checkout`);
      }
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(`${sourceRoot} exists but is not a Git checkout`);
      }
      throw error;
    }
  }
  const head = runGit(["-C", sourceRoot, "rev-parse", "HEAD"]).trim();
  if (head !== pins.markout.sourceCommit) {
    throw new Error(`bridge snapshot is ${head}, expected ${pins.markout.sourceCommit}`);
  }
  const changes = runGit(["-C", sourceRoot, "status", "--porcelain", "--untracked-files=no"]).trim();
  if (changes) {
    throw new Error(`bridge snapshot has tracked modifications:\n${changes}`);
  }
  const evalHash = `sha256:${createHash("sha256")
    .update(await readFile(path.join(sourceRoot, pins.applicability.sourcePath)))
    .digest("hex")}`;
  if (evalHash !== pins.ct24.sourceEvalHash) {
    throw new Error(`bridge source eval hash mismatch: expected ${pins.ct24.sourceEvalHash}, got ${evalHash}`);
  }
}

async function prepareBridgeOverlay() {
  await rm(markoutRoot, { recursive: true, force: true });
  const gitDirectory = path.join(sourceRoot, ".git");
  await cp(sourceRoot, markoutRoot, {
    recursive: true,
    filter: (source) => source !== gitDirectory && !source.startsWith(gitDirectory + path.sep),
  });
  const evalDirectory = path.join(markoutRoot, "grounding", "markout");
  const evalPath = path.join(evalDirectory, "eval.yaml");
  const source = parse(await readFile(evalPath, "utf8"));
  for (const scenario of source.scenarios ?? []) {
    scenario.setup ??= {};
    scenario.setup.files ??= [];
    if (scenario.setup.files.some((file) => file.path === "global.json")) {
      throw new Error(`${scenario.name}: source eval already supplies global.json`);
    }
    scenario.setup.files.unshift({ source: "global.json", path: "global.json" });
  }
  await writeFile(
    path.join(evalDirectory, "global.json"),
    `${JSON.stringify({
      sdk: {
        version: pins.dotnet.sdkVersion,
        rollForward: "disable",
        allowPrerelease: false,
      },
    }, null, 2)}\n`
  );
  const text = stringify(source, { lineWidth: 0 });
  await writeFile(evalPath, text);
  const hash = `sha256:${createHash("sha256").update(text).digest("hex")}`;
  if (pins.customBridge.sdkOverlayEvalHash !== "TO_BE_PINNED" &&
      hash !== pins.customBridge.sdkOverlayEvalHash) {
    throw new Error(
      `bridge SDK overlay eval hash mismatch: expected ${pins.customBridge.sdkOverlayEvalHash}, got ${hash}`
    );
  }
  return hash;
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: infraRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout;
}
