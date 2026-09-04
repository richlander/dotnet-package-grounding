import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(experimentRoot, "../..");

export async function analyzeMatrix(runDirectory) {
  const runRoot = path.resolve(runDirectory);
  const matrix = JSON.parse(await readFile(path.join(runRoot, "matrix-manifest.json"), "utf8"));
  if (matrix.status !== "complete" || !Array.isArray(matrix.models) || matrix.models.length === 0) {
    throw new Error(`${runRoot}: matrix is not complete`);
  }

  const cards = path.join(runRoot, "cards");
  await mkdir(cards, { recursive: true });
  const rows = [];
  for (const child of matrix.models) {
    const resultDirectory = path.join(runRoot, child.runDirectory);
    const manifest = path.join(experimentRoot, "generated", child.graderManifestFile);
    const common = [
      "--grader-manifest", manifest,
      "--runs", String(matrix.k),
      "--model", child.model,
      "--iet-model", "openai"
    ];
    const taskFile = `${child.model}.task-card.md`;
    const skillFile = `${child.model}.skill-cards.md`;
    await writeFile(
      path.join(cards, taskFile),
      runGrounding(["vally", "task-card", resultDirectory, ...common])
    );
    await writeFile(
      path.join(cards, skillFile),
      runGrounding([
        "vally", "skill-card", resultDirectory,
        path.join(experimentRoot, "applicability.system-commandline-ct24.json"),
        ...common
      ])
    );
    rows.push(`| \`${child.model}\` | ${child.role} | [task card](cards/${taskFile}) | [skill cards](cards/${skillFile}) |`);
  }

  const index = `# System.CommandLine GPT-5.6 matrix

This index reports completion and links model-specific cards. It intentionally contains no pooled
yield, reliability, fidelity, harm, or efficiency quantities.

| model | role | task-level card | natural-activation skill cards |
|---|---|---|---|
${rows.join("\n")}

**Suite:** ${matrix.suite}  
**Package:** System.CommandLine ${matrix.packageVersion}  
**Runs:** k=${matrix.k} per task and arm  
**Source:** \`${matrix.sourceCommit}\`  
**Vally:** ${matrix.vallyVersion} at \`${matrix.vallyCommit}\`
`;
  await writeFile(path.join(runRoot, "index.md"), index);
  return path.join(runRoot, "index.md");
}

function runGrounding(args) {
  const result = spawnSync(path.join(repositoryRoot, "eng", "grounding"), args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`grounding ${args.join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) {
    console.error("usage: npm run analyze -- <matrix run directory>");
    process.exit(2);
  }
  console.log(await analyzeMatrix(process.argv[2]));
}
