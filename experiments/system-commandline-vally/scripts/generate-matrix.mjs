import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse, stringify } from "yaml";
import { writeGraderManifest } from "./grader-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function generateMatrix({ allowUnpinned = false } = {}) {
  const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
  const applicability = JSON.parse(
    await readFile(path.join(root, "applicability.system-commandline-ct24.json"), "utf8")
  );
  const sourcePath = path.join(root, "vendor/source/eval.yaml");
  const sourceBytes = await readFile(sourcePath);
  const sourceHash = sha256(sourceBytes);
  assertPinned("source eval", sourceHash, pins.source.evalHash, allowUnpinned);

  const source = parse(sourceBytes.toString("utf8"));
  const scenarios = source.scenarios ?? [];
  const expectedIds = Array.from({ length: 24 }, (_, index) =>
    `C${String(index + 1).padStart(2, "0")}`
  );
  const actualIds = scenarios.map((scenario) => scenario.name?.slice(0, 3));
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`pinned source is not C01-C24: ${actualIds.join(", ")}`);
  }

  const applicabilityBySkill = new Map(
    applicability.skills.map((skill) => [skill.name, new Set(skill.tasks)])
  );
  for (const [index, scenario] of scenarios.entries()) {
    const taskId = expectedIds[index];
    const expectedSkill = scenario.expected_skill;
    if (!applicabilityBySkill.get(expectedSkill)?.has(taskId)) {
      throw new Error(`${taskId}: applicability does not preserve expected_skill '${expectedSkill}'`);
    }
    if (!Array.isArray(scenario.setup?.files) || scenario.setup.files.length < 2) {
      throw new Error(`${taskId}: expected fixture files`);
    }
  }

  await mkdir(path.join(root, "generated"), { recursive: true });
  const artifacts = {};
  for (const model of pins.vally.models) {
    const evalFile = `eval.${model.id}.yaml`;
    const experimentFile = `experiment.${model.id}.yaml`;
    const manifestFile = `grader-manifest.${model.id}.json`;
    const modelPins = pins.matrix.models[model.id];
    if (!modelPins) throw new Error(`missing matrix pins for ${model.id}`);

    const evalSpec = {
      name: "system-commandline-3.0-preview.7-ct24",
      description: "System.CommandLine CT-24 full-shelf evaluation with deterministic ends-versus-means grading.",
      version: pins.systemCommandLine.packageVersion,
      type: "capability",
      tags: {
        "system-commandline-package-version": pins.systemCommandLine.packageVersion,
        "system-commandline-package-sha256": pins.systemCommandLine.packageSha256,
        "source-eval-sha256": sourceHash,
        "fixture-hash": pins.fixtures.hash,
        "shelf-hash": pins.shelf.hash,
        "applicability-hash": pins.applicability.hash,
        "skills-source-commit": pins.source.commit,
        "package-source-commit": pins.systemCommandLine.sourceRepositoryCommit,
        "vally-source-commit": pins.vally.sourceCommit,
        "copilot-sdk-version": pins.vally.copilotSdkVersion,
        "copilot-cli-version": pins.vally.copilotCliVersion,
        "model-role": model.role
      },
      defaults: {
        runs: pins.matrix.k,
        timeout: "20m",
        executor: "copilot-sdk",
        model: model.id,
        reasoning_effort: model.reasoningEffort,
        judge_model: pins.vally.judgeModel,
        judge_reasoning_effort: pins.vally.judgeReasoningEffort
      },
      scoring: { threshold: 1 },
      stimuli: scenarios.map(translateScenario)
    };

    const evalText = stringify(evalSpec, { lineWidth: 0 });
    const evalPath = path.join(root, "generated", evalFile);
    await writeFile(evalPath, evalText);
    const evalHash = sha256(Buffer.from(evalText));
    assertPinned(`${model.id} eval`, evalHash, modelPins.evalHash, allowUnpinned);

    const experiment = {
      name: `system-commandline-ct24-${model.id}`,
      evals: [evalFile],
      vary: ["/environment/skills"],
      baseline: "baseline",
      variants: {
        baseline: { environment: { skills: [] } },
        grounded: {
          environment: {
            skills: applicability.skills.map((skill) =>
              `../vendor/skills/${skill.name}`
            )
          }
        }
      },
      execution: { workers: 1 }
    };
    await writeFile(
      path.join(root, "generated", experimentFile),
      stringify(experiment, { lineWidth: 0 })
    );

    const graderManifest = await writeGraderManifest({
      evalPath,
      outputPath: path.join(root, "generated", manifestFile),
      expectedEvalHash: modelPins.evalHash,
      expectedManifestHash: modelPins.graderManifestHash,
      allowUnpinned,
    });
    artifacts[model.id] = {
      evalFile,
      experimentFile,
      manifestFile,
      evalHash,
      graderManifestHash: graderManifest.manifestHash,
    };
  }

  return { sourceHash, artifacts };
}

function translateScenario(scenario, scenarioIndex) {
  const taskId = scenario.name.slice(0, 3);
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
        { src: "../global.json", dest: "global.json" },
        ...scenario.setup.files.map((file) => ({
          src: `../vendor/${file.source}`,
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
      ...(scenario.assertions ?? []).map((assertion, assertionIndex) =>
        translateAssertion(taskId, assertion, assertionIndex)
      )
    ]
  };
}

function translateAssertion(taskId, assertion, assertionIndex) {
  const tier = assertion.type === "file_not_contains" ||
    assertion.command_to_run === "grep"
    ? "delivers"
    : "satisfies";
  const number = String(assertionIndex + 1).padStart(2, "0");
  const name = `${tier}/${number}-${assertionName(assertion)}`;

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
  if (assertion.type !== "run_command_and_assert") {
    throw new Error(`${taskId}: unsupported assertion type '${assertion.type}'`);
  }

  const config = {
    command: assertion.command_to_run,
    args: commandArguments(assertion.command_to_run, assertion.command_arguments),
    expected_exit_code: assertion.expected_exit_code,
    timeout: duration(assertion.command_timeout)
  };
  if (assertion.expected_std_output_matches !== undefined) {
    config.stdout_matches = assertion.expected_std_output_matches;
  }
  if (assertion.expected_std_output_contains !== undefined) {
    config.stdout_contains = assertion.expected_std_output_contains;
  }
  if (assertion.expected_std_error_matches !== undefined) {
    if (/[[\]().*+?{}\\|^$]/.test(assertion.expected_std_error_matches)) {
      throw new Error(`${taskId}: Vally 0.13 has no stderr regex support for '${assertion.expected_std_error_matches}'`);
    }
    config.stderr_contains = assertion.expected_std_error_matches;
  }
  return { type: "run-command", name, config };
}

function commandArguments(command, value) {
  const text = value?.trim() ?? "";
  if (text === "") return [];
  if (/["']/.test(text)) {
    throw new Error(`quoted command arguments require an explicit parser: ${text}`);
  }
  const tokens = text.split(/\s+/);
  if (command !== "grep") return tokens;

  const firstPattern = tokens.findIndex((token) => !token.startsWith("-"));
  if (firstPattern < 0 || firstPattern === tokens.length - 1) {
    throw new Error(`unsupported grep arguments: ${text}`);
  }
  return [
    ...tokens.slice(0, firstPattern),
    tokens.slice(firstPattern, -1).join(" "),
    tokens.at(-1)
  ];
}

function assertionName(assertion) {
  if (assertion.type === "file_not_contains") {
    return `forbids-${slug(assertion.value)}`;
  }
  if (assertion.command_to_run === "grep") {
    return `requires-${slug(assertion.command_arguments)}`;
  }
  if (assertion.command_arguments?.trim() === "build") return "builds";
  return `${slug(assertion.command_to_run)}-${slug(assertion.command_arguments)}`;
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
    .slice(0, 56);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertPinned(label, actual, expected, allowUnpinned) {
  if (allowUnpinned) return;
  if (actual !== expected) {
    throw new Error(`${label} hash mismatch: expected ${expected}, got ${actual}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(
    await generateMatrix({ allowUnpinned: process.argv.includes("--allow-unpinned") }),
    null,
    2
  ));
}
