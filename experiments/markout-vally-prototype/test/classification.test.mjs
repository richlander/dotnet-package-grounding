import test from "node:test";
import assert from "node:assert/strict";
import { classify, iet } from "../scripts/classification.mjs";

test("reconstructs the three outcome classes from named graders", () => {
  assert.equal(classify(record("positive", true, true)), "Delivers");
  assert.equal(classify(record("negative", false, false)), "Fails");
  assert.equal(classify(record("opposing", true, false)), "Satisfies");
});

test("enforces Delivers implies Satisfies", () => {
  assert.equal(classify(record("contradictory", false, true)), "Fails");
});

test("computes anthropic IET from persisted Vally metrics", () => {
  const value = iet(record("iet", true, true, {
    inputTokens: 1000,
    cacheReadTokens: 800,
    outputTokens: 100
  }));
  assert.equal(value, 830);
});

function record(id, satisfies, delivers, usage = {}) {
  return {
    type: "trial-result",
    status: "success",
    stimulus: "task",
    model: "claude-haiku-4.5",
    durationMs: 100,
    gradeResult: {
      details: [
        { name: "satisfies/build", passed: satisfies },
        { name: "delivers/approach", passed: delivers }
      ]
    },
    trajectory: {
      id,
      metrics: {
        tokenUsage: {
          inputTokens: usage.inputTokens ?? 100,
          cacheReadTokens: usage.cacheReadTokens ?? 0,
          outputTokens: usage.outputTokens ?? 10
        }
      },
      metadata: { model: "claude-haiku-4.5" }
    }
  };
}
