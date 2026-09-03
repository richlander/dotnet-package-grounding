import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classify } from "./classification.mjs";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));
const temp = await mkdtemp(path.join(os.tmpdir(), "system-commandline-vally-controls-"));
const tasks = [
  ["C01: parse an option and run an action", "c01-greeter", "c01"],
  ["C13: migrate a beta greeter to GA/3.x", "c13-migrate-greeter", "c13"],
  ["C20: case-insensitive constrained values (3.x)", "c20-ci-constrained", "c20"]
];
const controls = [
  ["positive", "Delivers"],
  ["negative", "Fails"],
  ["opposing", "Satisfies"]
];

try {
  for (const model of pins.vally.models) {
    const isolation = await prepareIsolation();
    try {
      const records = [];
      for (const [stimulus, fixture, short] of tasks) {
        for (const [control] of controls) {
          const workspace = path.join(temp, model.id, short, control);
          await mkdir(workspace, { recursive: true });
          await cp(
            path.join(root, "vendor", "fixtures", fixture, "App.csproj"),
            path.join(workspace, "App.csproj")
          );
          await cp(path.join(root, "global.json"), path.join(workspace, "global.json"));
          const program = control === "negative"
            ? path.join(root, "vendor", "fixtures", fixture, "Program.cs")
            : path.join(root, "controls", "solutions", `${short}-${control}.cs`);
          await cp(program, path.join(workspace, "Program.cs"));
          records.push(makeRecord(`${model.id}-${short}-${control}`, stimulus, workspace, model.id));
        }
      }

      const result = spawnSync(
        path.join(root, "node_modules", ".bin", "vally"),
        [
          "grade",
          "--eval-spec", `generated/eval.${model.id}.yaml`,
          "--output", "jsonl"
        ],
        {
          cwd: root,
          env: childEnvironment(isolation),
          input: records.map(JSON.stringify).join("\n"),
          encoding: "utf8",
          maxBuffer: 30 * 1024 * 1024
        }
      );
      if (result.error) throw result.error;

      const graded = result.stdout.split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const actual = new Map(graded.map((record) => [record.trajectory.id, classify(record)]));
      const failures = [];
      for (const [, , short] of tasks) {
        for (const [control, expected] of controls) {
          const id = `${model.id}-${short}-${control}`;
          const observed = actual.get(id);
          console.log(`${id}: ${observed}`);
          if (observed !== expected) {
            failures.push(`${id}: expected ${expected}, got ${observed ?? "missing"}`);
          }
        }
      }
      if (failures.length > 0) {
        throw new Error(`control verification failed:\n${failures.join("\n")}\n${result.stderr}`);
      }
    } finally {
      await isolation.dispose();
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

function makeRecord(id, stimulusName, workDir, model) {
  return {
    status: "success",
    gradeResult: null,
    trajectory: {
      id,
      stimulus: { name: stimulusName, prompt: "control" },
      events: [],
      metrics: {
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          callCount: 0,
          byModel: {}
        },
        toolCallCount: 0,
        toolCallBreakdown: {},
        simulatedToolCallCount: 0,
        skillActivationCount: 0,
        skillActivationBreakdown: {},
        turnCount: 1,
        wallTimeMs: 1,
        errorCount: 0
      },
      output: "control trajectory completed",
      workDir,
      metadata: {
        model,
        skillsLoaded: [],
        executor: "control",
        sessionID: id
      },
      endReason: "completed"
    }
  };
}
