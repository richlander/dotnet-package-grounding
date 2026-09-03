import assert from "node:assert/strict";
import test from "node:test";
import { validateArm } from "../scripts/vally-validation.mjs";

const task = {
  id: "CT01",
  name: "CT01: example",
  graders: [
    { name: "harness/completed", type: "completed" },
    { name: "satisfies/builds", type: "run-command" },
    { name: "delivers/uses-api", type: "file-not-contains" },
  ],
};
const manifest = {
  evalName: "example",
  evalFile: "eval.yaml",
  evalHash: `sha256:${"a".repeat(64)}`,
  model: "claude-haiku-4.5",
  k: 2,
  tasks: [task],
  byId: new Map([[task.id, task]]),
};

test("rejects uneven trial identities", () => {
  const records = [trial(0), trial(0)];
  assert.throws(
    () => validateArm(records, { arm: "baseline", manifest }),
    /duplicate or missing trial indexes/
  );
});

test("rejects an omitted outcome grader", () => {
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
    },
    gradeResult: {
      details: task.graders.map((grader) => ({
        name: grader.name,
        graderType: grader.type,
        passed: true,
      })),
    },
    trajectory: {
      metrics: {
        tokenUsage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0 },
      },
    },
  };
}
