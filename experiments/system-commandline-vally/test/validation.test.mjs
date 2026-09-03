import assert from "node:assert/strict";
import test from "node:test";
import { validateArm } from "../scripts/vally-validation.mjs";

const task = {
  id: "C01",
  name: "C01: example",
  graders: [
    { name: "harness/completed", type: "completed" },
    { name: "satisfies/builds", type: "run-command" },
    { name: "delivers/uses-api", type: "file-not-contains" },
  ],
};
const manifest = {
  evalName: "example",
  evalFile: "eval.gpt-5.6-luna.yaml",
  evalHash: `sha256:${"a".repeat(64)}`,
  model: "gpt-5.6-luna",
  k: 2,
  tasks: [task],
};

test("accepts a complete exact child arm", () => {
  validateArm([trial(0), trial(1)], { arm: "baseline", manifest });
});

test("rejects a substituted matrix model", () => {
  const records = [trial(0), trial(1)];
  records[1].model = "gpt-5.6-terra";
  assert.throws(
    () => validateArm(records, { arm: "baseline", manifest }),
    /model mismatch/
  );
});

test("rejects missing or duplicate trial identities", () => {
  assert.throws(
    () => validateArm([trial(0), trial(0)], { arm: "baseline", manifest }),
    /duplicate or missing trial indexes/
  );
});

test("rejects a missing deterministic grader", () => {
  const records = [trial(0), trial(1)];
  records[0].gradeResult.details.pop();
  assert.throws(
    () => validateArm(records, { arm: "baseline", manifest }),
    /grader count mismatch/
  );
});

function trial(index) {
  return {
    type: "trial-result",
    evalName: manifest.evalName,
    evalFilePath: `/tmp/${manifest.evalFile}`,
    itemId: `/tmp/${manifest.evalFile}::baseline::${manifest.model}::${task.name}::trial-${index}`,
    variant: "baseline",
    stimulus: task.name,
    model: manifest.model,
    trialIndex: index,
    totalTrials: manifest.k,
    status: "success",
    durationMs: 100,
    experiment: {
      evalFile: manifest.evalFile,
      evalHash: manifest.evalHash.slice(7, 23),
      variant: "baseline",
      configHash: "0123456789abcdef"
    },
    gradeResult: {
      details: task.graders.map((grader) => ({
        name: grader.name,
        graderType: grader.type,
        passed: true,
      })),
    },
    trajectory: {
      metadata: { model: manifest.model },
      metrics: {
        tokenUsage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0 },
      },
    },
  };
}
