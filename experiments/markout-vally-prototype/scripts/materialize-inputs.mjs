import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCt24Eval } from "./generate-ct24-eval.mjs";
import { writeGraderManifest } from "./grader-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
const applicabilityHash = `sha256:${createHash("sha256")
  .update(await readFile(path.join(root, "applicability.markout-ct24.json")))
  .digest("hex")}`;
assertHash("applicability", applicabilityHash, pins.applicability.hash);

const fixtureSources = Array.from({ length: 24 }, (_, index) => {
  const id = `CT${String(index + 1).padStart(2, "0")}`;
  const destination = id.toLowerCase();
  return [
    [`fixtures/${destination}/Report.csproj`, `grounding/markout/fixtures/ct/${id}/Report.csproj`],
    [`fixtures/${destination}/Program.cs`, `grounding/markout/fixtures/ct/${id}/Program.cs`]
  ];
}).flat();
const sources = [
  ...fixtureSources,
  ["skills/markout/SKILL.md", "skills/markout/SKILL.md"],
  ["skills/markout-built-in-shapes/SKILL.md", "skills/markout-built-in-shapes/SKILL.md"],
  ["skills/markout-conditional-composition/SKILL.md", "skills/markout-conditional-composition/SKILL.md"],
  ["skills/markout-output-formats/SKILL.md", "skills/markout-output-formats/SKILL.md"],
  ["skills/markout-composite-cells-cards/SKILL.md", "skills/markout-composite-cells-cards/SKILL.md"],
  ["skills/plugin.json", "skills/plugin.json"],
  ["source/markout-eval.yaml", "grounding/markout/eval.yaml"]
];

const vendor = path.join(root, "vendor");
await withMaterializeLock(async () => {
  await rm(vendor, { recursive: true, force: true });

  for (const [destination, source] of sources) {
    const url = `https://raw.githubusercontent.com/richlander/markout/${pins.markout.sourceCommit}/${source}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to fetch ${source}: HTTP ${response.status}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    const target = path.join(vendor, destination);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  const fixtureFiles = fixtureSources.map(([dest]) => dest);
  const representativeFixtureFiles = fixtureFiles.filter((p) =>
    p.startsWith("fixtures/ct01/") ||
    p.startsWith("fixtures/ct15/") ||
    p.startsWith("fixtures/ct18/")
  );
  const shelfFiles = sources.map(([dest]) => dest).filter((p) => p.startsWith("skills/"));
  const fixtureHash = await hashFiles(vendor, representativeFixtureFiles);
  const ct24FixtureHash = await hashFiles(vendor, fixtureFiles);
  const shelfHash = await hashFiles(vendor, shelfFiles);
  const generated = await generateCt24Eval({
    allowUnpinned: pins.ct24.vallyEvalHash === "TO_BE_PINNED" ||
      pins.ct24.graderManifestHash === "TO_BE_PINNED"
  });
  const prototypeManifest = await writeGraderManifest({
    evalPath: path.join(root, "eval.yaml"),
    outputPath: path.join(root, "grader-manifest.prototype.json"),
    expectedEvalHash: pins.prototype.vallyEvalHash,
    expectedManifestHash: pins.prototype.graderManifestHash,
    allowUnpinned: pins.prototype.vallyEvalHash === "TO_BE_PINNED" ||
      pins.prototype.graderManifestHash === "TO_BE_PINNED",
  });

  if (pins.fixtures.hash === "TO_BE_PINNED" ||
      pins.shelf.hash === "TO_BE_PINNED" ||
      pins.ct24.fixtureHash === "TO_BE_PINNED" ||
      pins.ct24.vallyEvalHash === "TO_BE_PINNED" ||
      pins.ct24.graderManifestHash === "TO_BE_PINNED" ||
      pins.prototype.vallyEvalHash === "TO_BE_PINNED" ||
      pins.prototype.graderManifestHash === "TO_BE_PINNED") {
    console.log(JSON.stringify({
      fixtureHash,
      ct24FixtureHash,
      shelfHash,
      sourceEvalHash: generated.sourceHash,
      vallyEvalHash: generated.generatedHash,
      ct24GraderManifestHash: generated.graderManifestHash,
      prototypeVallyEvalHash: prototypeManifest.evalHash,
      prototypeGraderManifestHash: prototypeManifest.manifestHash,
    }, null, 2));
    process.exitCode = 2;
  } else {
    assertHash("fixture", fixtureHash, pins.fixtures.hash);
    assertHash("CT-24 fixture", ct24FixtureHash, pins.ct24.fixtureHash);
    assertHash("shelf", shelfHash, pins.shelf.hash);
    console.log(`inputs verified: fixtures ${fixtureHash}; CT-24 fixtures ${ct24FixtureHash}; shelf ${shelfHash}; applicability ${applicabilityHash}; eval ${generated.generatedHash}; grader manifest ${generated.graderManifestHash}`);
  }
});

async function hashFiles(base, files) {
  const hash = createHash("sha256");
  for (const relative of [...files].sort()) {
    hash.update(relative);
    hash.update("\0");
    hash.update(await readFile(path.join(base, relative)));
  }
  return `sha256:${hash.digest("hex")}`;
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
