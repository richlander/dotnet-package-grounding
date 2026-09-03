import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const applicability = JSON.parse(await readFile(path.join(root, "applicability.markout-ct24.json"), "utf8"));
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));

test("pins the complete authored CT-24 applicability prior", () => {
  assert.equal(applicability.source.commit, pins.applicability.sourceCommit);
  assert.equal(applicability.source.commit, pins.markout.sourceCommit);

  const skills = new Map(applicability.skills.map((skill) => [skill.name, new Set(skill.tasks)]));
  const taskIds = Array.from({ length: 24 }, (_, index) => `CT${String(index + 1).padStart(2, "0")}`);
  assert.deepEqual([...skills.get("markout")].sort(), taskIds);

  const owner = {
    CT07: "markout-conditional-composition",
    CT08: "markout-conditional-composition",
    CT09: "markout-output-formats",
    CT10: "markout-built-in-shapes",
    CT11: "markout-composite-cells-cards",
    CT12: "markout-conditional-composition",
    CT13: "markout-conditional-composition",
    CT14: "markout-output-formats",
    CT15: "markout-built-in-shapes",
    CT16: "markout-composite-cells-cards",
    CT17: "markout-conditional-composition",
    CT18: "markout-conditional-composition",
    CT19: "markout-output-formats",
    CT20: "markout-built-in-shapes",
    CT21: "markout-composite-cells-cards",
    CT22: "markout-conditional-composition",
    CT23: "markout-output-formats",
    CT24: "markout-conditional-composition"
  };
  const domainSkills = [...skills.keys()].filter((name) => name !== "markout");
  for (const task of taskIds) {
    const actual = domainSkills.filter((name) => skills.get(name).has(task));
    assert.deepEqual(actual, owner[task] ? [owner[task]] : [], task);
  }
});
