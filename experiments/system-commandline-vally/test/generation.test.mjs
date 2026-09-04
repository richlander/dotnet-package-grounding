import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
const applicability = JSON.parse(
  await readFile(path.join(root, "applicability.system-commandline-ct24.json"), "utf8")
);

test("generates one exact deterministic eval per GPT-5.6 model", async () => {
  assert.deepEqual(
    pins.vally.models.map((model) => model.id),
    ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"]
  );
  for (const model of pins.vally.models) {
    const spec = parse(await readFile(
      path.join(root, "generated", `eval.${model.id}.yaml`),
      "utf8"
    ));
    assert.equal(spec.defaults.model, model.id);
    assert.equal(spec.defaults.reasoning_effort, "high");
    assert.equal(spec.defaults.runs, 5);
    assert.equal(spec.stimuli.length, 24);
    for (const stimulus of spec.stimuli) {
      const names = stimulus.graders.map((grader) => grader.name);
      assert.ok(names.some((name) => name.startsWith("satisfies/")));
      assert.ok(names.some((name) => name.startsWith("delivers/")));
      assert.ok(stimulus.graders.every((grader) =>
        ["completed", "run-command", "file-not-contains"].includes(grader.type)
      ));
    }
  }
});

test("applicability covers C01-C24 exactly once", () => {
  const tasks = applicability.skills.flatMap((skill) => skill.tasks).sort();
  const expected = Array.from({ length: 24 }, (_, index) =>
    `C${String(index + 1).padStart(2, "0")}`
  );
  assert.deepEqual(tasks, expected);
});

test("translation separates user-visible ends from API means", async () => {
  const spec = parse(await readFile(
    path.join(root, "generated", "eval.gpt-5.6-luna.yaml"),
    "utf8"
  ));
  const c03 = spec.stimuli.find((stimulus) => stimulus.tags["task-id"] === "C03");
  const satisfies = c03.graders.filter((grader) => grader.name.startsWith("satisfies/"));
  const delivers = c03.graders.filter((grader) => grader.name.startsWith("delivers/"));
  assert.equal(satisfies.length, 3);
  assert.equal(delivers.length, 2);
  assert.ok(satisfies.every((grader) => grader.type === "run-command"));
  assert.ok(delivers.some((grader) => grader.type === "file-not-contains"));
});

test("adapts stderr regex checks into deterministic Vally graders", async () => {
  const spec = parse(await readFile(
    path.join(root, "generated", "eval.gpt-5.6-luna.yaml"),
    "utf8"
  ));
  const c10 = spec.stimuli.find((stimulus) => stimulus.tags["task-id"] === "C10");
  const stderr = c10.graders.find((grader) =>
    grader.name.endsWith("-stderr-matches")
  );
  assert.equal(stderr.type, "run-command");
  assert.match(stderr.config.command, /2>&1 1>\/dev\/null \| grep -E/);
  assert.equal(stderr.config.expected_exit_code, 0);
});
