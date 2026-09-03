import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = parse(await readFile(path.join(root, "vendor/source/markout-eval.yaml"), "utf8"));
const generated = parse(await readFile(path.join(root, "eval.ct24.yaml"), "utf8"));
const sourceScenarios = source.scenarios.slice(0, 24);

assert.equal(generated.stimuli.length, 24);
const graderTypes = new Map();
for (const [index, stimulus] of generated.stimuli.entries()) {
  const original = sourceScenarios[index];
  const taskId = `CT${String(index + 1).padStart(2, "0")}`;
  assert.equal(stimulus.name, original.name);
  assert.equal(stimulus.prompt, original.prompt);
  assert.equal(stimulus.tags["task-id"], taskId);
  assert.equal(stimulus.tags["expected-skill"], original.expected_skill);
  assert.deepEqual(stimulus.constraints.reject_tools, original.reject_tools);
  assert.equal(stimulus.graders.length, original.assertions.length + 1);
  assert.deepEqual(stimulus.graders[0], { type: "completed", name: "harness/completed" });

  for (const file of stimulus.environment.files)
    await access(path.join(root, file.src));

  for (const [assertionIndex, assertion] of original.assertions.entries()) {
    const grader = stimulus.graders[assertionIndex + 1];
    assert.match(grader.name, new RegExp(`^${assertion.tier}/`));
    graderTypes.set(grader.type, (graderTypes.get(grader.type) ?? 0) + 1);
    if (assertion.type === "file_not_contains") {
      assert.equal(grader.type, "file-not-contains");
      assert.equal(grader.config.path, assertion.path);
      assert.equal(grader.config.value, assertion.value);
      continue;
    }
    assert.equal(grader.type, "run-command");
    assert.equal(grader.config.command, assertion.command_to_run);
    assert.equal(grader.config.args.join(" "), assertion.command_arguments);
    assert.equal(grader.config.expected_exit_code, assertion.expected_exit_code);
    assert.equal(grader.config.stdout_matches, assertion.expected_std_output_matches);
  }
}

assert.deepEqual(
  Object.fromEntries([...graderTypes].sort()),
  { "file-not-contains": 24, "run-command": 98 }
);
assert.equal(
  generated.stimuli.flatMap((stimulus) => stimulus.graders)
    .some((grader) => ["prompt", "panel"].includes(grader.type)),
  false
);
console.log("CT-24 generated spec equivalence: passed");
