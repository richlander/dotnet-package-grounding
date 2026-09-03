# grounding — eval orchestration & analysis (C#)

A single Native-AOT CLI that ports this repo's Python/shell tooling. It drives the
external `skill-validator` harness and renders the grounding metric cards. The eval
engine (`skill-validator`) stays external; build it once via `eng/run-evals.sh`.

Build / run:

```bash
dotnet build src/grounding -c Release
dotnet src/grounding/bin/Release/net11.0/grounding.dll --help
eng/grounding --help            # launcher: incrementally builds, then forwards args
```

## Install as a native tool on PATH

The CLI is **Native AOT** and publishes as a single self-contained file (SQLite is
compiled in — see `e_sqlite3-static.targets`). Install it with
[`dotnet-install`](https://github.com/richlander/dotnet-install), which places it in
`~/.dotnet/bin` — on PATH, and not the SDK's tool store, so `dotnet tool` operations
cannot prune it:

```bash
dotnet tool install -g dotnet-install   # one-time
dotnet-install . -o ~/.dotnet/bin       # from the repo root
grounding --help                        # now a bare command, anywhere
```

Without `-o`, `dotnet-install` installs repo-locally to `<repo>/.dotnet/bin`, which is not
on PATH.

Conventional (framework-dependent) global-tool route, if preferred:

```bash
dotnet pack src/grounding -c Release
dotnet tool install --global --add-source src/grounding/nupkg dotnet-package-grounding
```

## Commands

| Command | Notes |
| --- | --- |
| `analyze <results.json...>` | default = raw per-scenario table |
| `analyze --card / --doc-card / --model-diff / --source-diff / --tools-card / --web-card` | also `-v <view>`; `--no-title` supported |
| `vally task-card <run-directory> --grader-manifest <manifest.json>` | fail-closed reconstruction of deterministic ladder outcomes and task-level metrics from Vally experiment JSONL |
| `vally skill-card <run-directory> <applicability> --grader-manifest <manifest.json>` | fail-closed six-row observational per-skill cards from natural full-shelf activation |
| `run <unit> --source skill\|readme\|none` | skill/README/nothing toggle; `--dry-run`, `--emit-skill` |
| `gen-plugins` | expand `grounding/**/plugin.json.in` |
| `rescore <model=path>… [--w N]` | IET rubric, Pareto gate |
| `rescore --all` | batch over `.skill-validator-results/` |
| `channels extract [dir]` | per-model channel matrix (default dir `data/markout`) |
| `channels compare` | cross-channel IET (data/markout) |
| `mcp [--root <repo>]` | stdio JSON-RPC server (`GROUNDING_GATE`) |

This CLI is the single implementation of the repo's eval tooling.

The Vally card commands require a schema-1 grader manifest. The manifest is authoritative
for the eval name/hash, model, `k`, exact stimulus set, and each stimulus's exact top-level
grader names and types. Records with execution errors, provenance/identity mismatches, or
missing, duplicate, renamed, unexpected, or type-mismatched graders are rejected rather
than classified as ladder failures.

## Source toggle (skill / README / nothing)

`run --source` is the first-class toggle for *what fills the grounded arm*:

```bash
grounding run markout --source skill --model "claude-haiku-4.5 claude-opus-5" --runs 3
grounding run markout --source readme --readme-file path/to/README.md
grounding run markout --source none
grounding run markout --source skill --dry-run      # print the plan only
grounding run markout --source skill --emit-skill /tmp/SKILL.md
```

`run` reversibly swaps the unit's `grounding/<unit>/SKILL.md` to the chosen source, invokes
`skill-validator`, copies `results.json` into `data/<unit>-6q/<tag>.json`
(`<unit>` / `<unit>-readme` / `<unit>-none`), restores `SKILL.md`, then prints the
table.

## Eval scripts

The harness scripts in `eng/` (`run-evals.sh`, `run-*-6q.sh`,
`run-channel-matrix.sh`) call this CLI through the `eng/grounding` launcher,
which incrementally builds the project and forwards arguments. The MCP eval units spawn
the server via `dotnet <grounding.dll> mcp --root <repo>` (skill-validator's
command allowlist permits `dotnet`, not arbitrary binaries).
