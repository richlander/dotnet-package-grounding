import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { generateMatrix } from "./generate-matrix.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(root, "../..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
const allowUnpinned = process.argv.includes("--allow-unpinned");
const applicabilityHash = sha256(
  await readFile(path.join(root, "applicability.system-commandline-ct24.json"))
);

await withMaterializeLock(async () => {
  const vendor = path.join(root, "vendor");
  await rm(vendor, { recursive: true, force: true });

  const sourceEval = gitShow(pins.source.evalPath);
  await writeVendor("source/eval.yaml", sourceEval);
  const source = parse(sourceEval.toString("utf8"));
  const fixtureSources = [...new Set(
    source.scenarios.flatMap((scenario) =>
      scenario.setup.files.map((file) => file.source)
    )
  )].sort();
  for (const sourcePath of fixtureSources) {
    await writeVendor(sourcePath, gitShow(
      `examples/system-commandline/grounding/system-commandline/${sourcePath}`
    ));
  }

  const skillFiles = gitList(pins.source.skillsPath)
    .filter((file) => file.endsWith("/SKILL.md") || file.endsWith("/plugin.json"));
  for (const sourcePath of skillFiles) {
    const relative = path.relative(pins.source.skillsPath, sourcePath);
    await writeVendor(`skills/${relative}`, gitShow(sourcePath));
  }

  const sourceEvalHash = sha256(sourceEval);
  const fixtureHash = await hashFiles(vendor, fixtureSources);
  const shelfHash = await hashFiles(
    vendor,
    skillFiles.map((file) => `skills/${path.relative(pins.source.skillsPath, file)}`)
  );
  const generated = await generateMatrix({ allowUnpinned });

  const observed = {
    sourceEvalHash,
    fixtureHash,
    shelfHash,
    applicabilityHash,
    models: generated.artifacts,
  };
  if (allowUnpinned) {
    console.log(JSON.stringify(observed, null, 2));
    process.exitCode = 2;
    return;
  }
  assertHash("source eval", sourceEvalHash, pins.source.evalHash);
  assertHash("fixtures", fixtureHash, pins.fixtures.hash);
  assertHash("shelf", shelfHash, pins.shelf.hash);
  assertHash("applicability", applicabilityHash, pins.applicability.hash);
  console.log(
    `inputs verified: source ${sourceEvalHash}; fixtures ${fixtureHash}; ` +
    `shelf ${shelfHash}; applicability ${applicabilityHash}`
  );

  async function writeVendor(relative, bytes) {
    const target = path.join(vendor, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
});

function gitShow(sourcePath) {
  const result = spawnSync(
    "git",
    ["show", `${pins.source.commit}:${sourcePath}`],
    { cwd: repositoryRoot, encoding: null, maxBuffer: 20 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`git show failed for ${sourcePath}:\n${result.stderr?.toString()}`);
  }
  return result.stdout;
}

function gitList(sourcePath) {
  const result = spawnSync(
    "git",
    ["ls-tree", "-r", "--name-only", pins.source.commit, "--", sourcePath],
    { cwd: repositoryRoot, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`git ls-tree failed for ${sourcePath}:\n${result.stderr}`);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
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

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertHash(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} hash mismatch: expected ${expected}, got ${actual}`);
  }
}

async function withMaterializeLock(action) {
  const cache = path.join(root, ".cache");
  const lock = path.join(cache, "materialize.lock");
  await mkdir(cache, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const ageMs = Date.now() - (await stat(lock)).mtimeMs;
      if (ageMs > 10 * 60 * 1000) {
        await rm(lock, { recursive: true, force: true });
        continue;
      }
      if (attempt >= 240) {
        throw new Error("timed out waiting for the input materialization lock");
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  try {
    await action();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
