import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classify } from "./classification.mjs";
import { childEnvironment, prepareIsolation } from "./isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "markout-vally-controls-"));
const isolation = await prepareIsolation();

const tasks = [
  ["CT01-minimal-report", "ct01"],
  ["CT15-dependency-tree", "ct15"],
  ["CT18-verbosity-levels", "ct18"]
];
const controls = [
  ["positive", "Delivers"],
  ["negative", "Fails"],
  ["opposing", "Satisfies"]
];

try {
  const records = [];
  for (const [stimulus, fixture] of tasks) {
    for (const [control] of controls) {
      const workspace = path.join(temp, fixture, control);
      await mkdir(workspace, { recursive: true });
      await cp(
        path.join(root, "vendor", "fixtures", fixture, "Report.csproj"),
        path.join(workspace, "Report.csproj")
      );
      await cp(path.join(root, "global.json"), path.join(workspace, "global.json"));
      const program = control === "negative"
        ? path.join(root, "vendor", "fixtures", fixture, "Program.cs")
        : path.join(root, "controls", "solutions", `${fixture}-${control}.cs`);
      await cp(program, path.join(workspace, "Program.cs"));
      records.push(makeRecord(`${fixture}-${control}`, stimulus, workspace));
    }
  }

  const result = spawnSync(
    path.join(root, "node_modules", ".bin", "vally"),
    ["grade", "--eval-spec", "controls/eval.yaml", "--output", "jsonl"],
    {
      cwd: root,
      env: childEnvironment(isolation),
      input: records.map(JSON.stringify).join("\n"),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    }
  );
  if (result.error) throw result.error;

  const graded = result.stdout.split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const actual = new Map(graded.map((record) => [record.trajectory.id, classify(record)]));
  const failures = [];
  for (const [stimulus, fixture] of tasks) {
    for (const [control, expected] of controls) {
      const id = `${fixture}-${control}`;
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
  await rm(temp, { recursive: true, force: true });
}

function makeRecord(id, stimulusName, workDir) {
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
        model: "claude-haiku-4.5",
        skillsLoaded: [],
        executor: "control",
        sessionID: id
      },
      endReason: "completed"
    }
  };
}
