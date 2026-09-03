import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const deterministicGraders = new Set(["completed", "run-command", "file-not-contains"]);

export async function writeGraderManifest({
  evalPath,
  outputPath,
  expectedEvalHash,
  expectedManifestHash,
  allowUnpinned = false,
}) {
  const evalBytes = await readFile(evalPath);
  const evalHash = sha256(evalBytes);
  assertPinned(`${path.basename(evalPath)} hash`, evalHash, expectedEvalHash, allowUnpinned);
  const spec = parse(evalBytes.toString("utf8"));
  const k = spec.defaults?.runs;
  const model = spec.defaults?.model;
  if (!spec.name || !Number.isInteger(k) || k <= 0 || !model || !Array.isArray(spec.stimuli)) {
    throw new Error(`${evalPath}: eval name, positive defaults.runs, defaults.model, and stimuli are required`);
  }

  const tasks = spec.stimuli.map((stimulus) => {
    const id = stimulus.tags?.["task-id"];
    if (!id || !stimulus.name || !Array.isArray(stimulus.graders)) {
      throw new Error(`${evalPath}: every stimulus needs task-id, name, and graders`);
    }
    const graders = stimulus.graders.map((grader) => {
      if (!grader.name || !grader.type) {
        throw new Error(`${stimulus.name}: every grader needs name and type`);
      }
      if (!deterministicGraders.has(grader.type)) {
        throw new Error(`${stimulus.name}: unsupported nondeterministic grader type '${grader.type}'`);
      }
      return { name: grader.name, type: grader.type };
    });
    if (new Set(graders.map((grader) => grader.name)).size !== graders.length) {
      throw new Error(`${stimulus.name}: duplicate grader names`);
    }
    if (!graders.some((grader) => grader.name.startsWith("satisfies/")) ||
        !graders.some((grader) => grader.name.startsWith("delivers/"))) {
      throw new Error(`${stimulus.name}: named satisfies/ and delivers/ graders are required`);
    }
    return { id, name: stimulus.name, graders };
  });
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length ||
      new Set(tasks.map((task) => task.name)).size !== tasks.length) {
    throw new Error(`${evalPath}: task ids and stimulus names must be unique`);
  }

  const manifest = {
    schema: 1,
    evalName: spec.name,
    evalFile: path.basename(evalPath),
    evalHash,
    model,
    k,
    tasks,
  };
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestHash = sha256(Buffer.from(text));
  assertPinned(`${path.basename(outputPath)} hash`, manifestHash, expectedManifestHash, allowUnpinned);
  await writeFile(outputPath, text);
  return { evalHash, manifestHash };
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertPinned(label, actual, expected, allowUnpinned) {
  if (allowUnpinned) return;
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}
