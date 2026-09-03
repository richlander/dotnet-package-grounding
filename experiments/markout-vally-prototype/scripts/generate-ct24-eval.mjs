import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse, stringify } from "yaml";
import { writeGraderManifest } from "./grader-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function generateCt24Eval({ allowUnpinned = false } = {}) {
  const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
  const applicability = JSON.parse(
    await readFile(path.join(root, "applicability.markout-ct24.json"), "utf8")
  );
  const sourcePath = path.join(root, "vendor/source/markout-eval.yaml");
  const sourceBytes = await readFile(sourcePath);
  const sourceHash = sha256(sourceBytes);
  assertPinned("CT-24 source eval", sourceHash, pins.ct24.sourceEvalHash, allowUnpinned);

  const source = parse(sourceBytes.toString("utf8"));
  const scenarios = source.scenarios?.slice(0, 24) ?? [];
  const expectedIds = Array.from({ length: 24 }, (_, index) =>
    `CT${String(index + 1).padStart(2, "0")}`
  );
  const actualIds = scenarios.map((scenario) => scenario.name?.slice(0, 4));
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`pinned source no longer begins with CT01-CT24: ${actualIds.join(", ")}`);
  }

  const applicabilityBySkill = new Map(
    applicability.skills.map((skill) => [skill.name, new Set(skill.tasks)])
  );
  for (const [index, scenario] of scenarios.entries()) {
    const taskId = expectedIds[index];
    const expectedSkill = scenario.expected_skill;
    if (!applicabilityBySkill.has(expectedSkill)) {
      throw new Error(`${taskId}: expected_skill '${expectedSkill}' is absent from applicability`);
    }
    if (!applicabilityBySkill.get(expectedSkill).has(taskId)) {
      throw new Error(`${taskId}: applicability does not preserve expected_skill '${expectedSkill}'`);
    }
    if (scenario.setup?.files?.length !== 2) {
      throw new Error(`${taskId}: expected exactly two fixture files`);
    }
  }

  const evalSpec = {
    name: "markout-0.35.2-ct24",
    description: "Complete CT-24 full-shelf evaluation translated deterministically from the pinned Markout regime.",
    version: pins.markout.packageVersion,
    type: "capability",
    tags: {
      "markout-package-version": pins.markout.packageVersion,
      "markout-package-sha256": pins.markout.packageSha256,
      "ct24-source-eval-sha256": sourceHash,
      "ct24-fixture-hash": pins.ct24.fixtureHash,
      "shelf-hash": pins.shelf.hash,
      "applicability-hash": pins.applicability.hash,
      "markout-source-commit": pins.markout.sourceCommit,
      "vally-source-commit": pins.vally.sourceCommit
    },
    defaults: {
      runs: 5,
      timeout: "20m",
      executor: "copilot-sdk",
      model: pins.vally.agentModel,
      ...(pins.vally.agentReasoningEffort
        ? { reasoning_effort: pins.vally.agentReasoningEffort }
        : {}),
      judge_model: pins.vally.judgeModel,
      judge_reasoning_effort: pins.vally.judgeReasoningEffort
    },
    scoring: { threshold: 1 },
    stimuli: scenarios.map(translateScenario)
  };

  const generated = stringify(evalSpec, { lineWidth: 0 });
  const outputPath = path.join(root, "eval.ct24.yaml");
  await writeFile(outputPath, generated);
  const generatedHash = sha256(Buffer.from(generated));
  assertPinned("generated CT-24 Vally eval", generatedHash, pins.ct24.vallyEvalHash, allowUnpinned);
  const graderManifest = await writeGraderManifest({
    evalPath: outputPath,
    outputPath: path.join(root, "grader-manifest.ct24.json"),
    expectedEvalHash: pins.ct24.vallyEvalHash,
    expectedManifestHash: pins.ct24.graderManifestHash,
    allowUnpinned,
  });
  return {
    sourceHash,
    generatedHash,
    graderManifestHash: graderManifest.manifestHash,
    scenarioCount: scenarios.length,
  };
}

function translateScenario(scenario, scenarioIndex) {
  const taskId = scenario.name.slice(0, 4);
  const fixtureDirectory = taskId.toLowerCase();
  const assertions = scenario.assertions ?? [];
  const unsupported = assertions.filter(
    (assertion) => !["run_command_and_assert", "file_not_contains"].includes(assertion.type)
  );
  if (unsupported.length > 0) {
    throw new Error(`${taskId}: unsupported assertion types: ${unsupported.map((a) => a.type).join(", ")}`);
  }

  return {
    name: scenario.name,
    prompt: scenario.prompt,
    tags: {
      "task-id": taskId,
      "expected-skill": scenario.expected_skill,
      "source-index": String(scenarioIndex)
    },
    environment: {
      files: [
        { src: "global.json", dest: "global.json" },
        ...scenario.setup.files.map((file) => ({
          src: `vendor/fixtures/${fixtureDirectory}/${path.basename(file.source)}`,
          dest: file.path
        }))
      ]
    },
    constraints: {
      max_duration: duration(scenario.timeout ?? 1200),
      reject_tools: scenario.reject_tools ?? []
    },
    graders: [
      { type: "completed", name: "harness/completed" },
      ...assertions.map((assertion, assertionIndex) =>
        translateAssertion(taskId, assertion, assertionIndex)
      )
    ]
  };
}

function translateAssertion(taskId, assertion, assertionIndex) {
  if (!["satisfies", "delivers"].includes(assertion.tier)) {
    throw new Error(`${taskId}: unsupported assertion tier '${assertion.tier}'`);
  }
  const name = `${assertion.tier}/${String(assertionIndex + 1).padStart(2, "0")}-${slug(assertion.mini_prompt)}`;
  if (assertion.type === "file_not_contains") {
    return {
      type: "file-not-contains",
      name,
      config: {
        path: assertion.path,
        value: assertion.value
      }
    };
  }

  const config = {
    command: assertion.command_to_run,
    args: splitArguments(assertion.command_arguments),
    expected_exit_code: assertion.expected_exit_code,
    timeout: duration(assertion.command_timeout)
  };
  if (assertion.expected_std_output_matches !== undefined) {
    config.stdout_matches = assertion.expected_std_output_matches;
  }
  return { type: "run-command", name, config };
}

function splitArguments(value) {
  const text = value?.trim() ?? "";
  if (text.includes("\"") || text.includes("'")) {
    throw new Error(`quoted command arguments require an explicit parser: ${text}`);
  }
  return text === "" ? [] : text.split(/\s+/);
}

function duration(seconds) {
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error(`invalid timeout: ${seconds}`);
  }
  return seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`;
}

function slug(value) {
  return (value ?? "assertion")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertPinned(label, actual, expected, allowUnpinned) {
  if (expected === "TO_BE_PINNED" && allowUnpinned) return;
  if (actual !== expected) {
    throw new Error(`${label} hash mismatch: expected ${expected}, got ${actual}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await generateCt24Eval({ allowUnpinned: process.argv.includes("--allow-unpinned") }));
}
