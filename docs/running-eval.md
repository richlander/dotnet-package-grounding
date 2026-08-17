# Running eval

> **Reading the result?** What the numbers mean and how a run becomes a ship/no-ship call is the
> **[quality-card model](./quality-card-model.md)** (two axes — return + efficiency — and two ship
> gates). This doc is the *operational* how-to: build the harness, point it at a repo, run.

For the artificial package-documentation-denied upper-bound probe, add
`--package-baseline doc-stripped` and supply `COPILOT_GITHUB_TOKEN`. The harness runs both arms under
one disposable HOME with a documentation-stripped copy of the current warm NuGet cache and clears
the isolated user's default NuGet sources.
See [the cache confound and probe contract](harness.md#a-confound-the-baseline-can-read-the-package-from-the-nuget-cache).

This repo is the **generic eval harness**. It holds no package grounding of its own — the package's
`SKILL.md` skill set lives in the **package's own repo** under `skills/`, with its eval
(`eval.yaml` + `fixtures/`) beside it under `grounding/<unit>/`. You run eval by pointing the harness at that repo. Nothing is packed or published
to iterate: the harness reads the skill set **in place** from the target tree, so a typo fix is an edit
and a re-run.

## Prerequisites

- The `grounding` CLI, built from this repo — see
  [`harness.md`](./harness.md#build-and-install-the-grounding-cli).
- The `skill-validator` harness, built once into `.tools/skill-validator-<sha>/` (see [`harness.md`](./harness.md)).
  This is the only machine-specific artifact; `.tools/` is git-ignored, so build it for the platform you
  run on (e.g. `-r osx-arm64` or `-r linux-x64`).
- A checkout of the **target package repo** whose grounding you want to evaluate.
- `gh auth login` — `skill-validator`'s Copilot SDK rides your `gh` credentials.

## The bundle a target repo ships

A package repo carries a self-contained grounding bundle (inputs only — datasets are **not** committed):

```text
<target-repo>/
  skills/             # what ships inside the package
    <unit>/SKILL.md   #   base skill: YAML name + use-when description, then guidance
    <domain>/...      #   domain skills and progressive-disclosure support files
    plugin.json       #   installs the set together
  grounding/<unit>/   # what measures it, and never ships
    meta.yaml         #   name (== <unit>), package, description
    eval.yaml         #   CT-24 scenarios: prompt + setup fixtures + assertions
    fixtures/...      #   starting project(s), gated by `dotnet build`/`run`
    results.md        #   optional durable prose summary (the card lives in the PR)
```

The package may include a small base skill plus domain skills, installed into the consuming repo, so
delivery stays pull-based, opt-in, and removable.

## Point the harness at it

```bash
# Reads <target-repo>/skills/ as the shelf under test. No packing, no publish.
DATA="${GROUNDING_DATA_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/grounding}/<unit>-ct24"
grounding run <unit> --root <target-repo> --source skill --eval-mode holistic --runs 5 \
  -m "claude-haiku-4.5 claude-sonnet-5 claude-opus-5" --out "$DATA"
```

- **`--root`** (or the `GROUNDING_ROOT` env var) is the grounding root — the target repo. The
  `skill-validator` binary is still found in *this* repo's `.tools/`; only the grounding unit + eval are
  read from the target.
- **`--tests-dir` is auto-detected:** a co-located bundle (`grounding/<unit>/eval.yaml`) resolves to
  `grounding`; the classic split layout (`tests/<unit>/eval.yaml`) resolves to `tests`. Override with
  `--tests-dir` if needed.
- **`--source skill`** selects the grounded arm. The baseline arm (no grounding) always runs alongside;
  there are no live document-comparison arms.
- **`--eval-mode holistic`** grades the whole self-selecting skill set, which is the CT-24 lens.
- **`--scenarios S10 S18`** stages a focused run containing only scenario names that start with or
  contain those tokens. Focused datasets get a distinct tag and do not overwrite the full suite.

If the target repo's bundle includes `run.sh` / `run.ps1`, those should wrap the same flow — run them
from the package repo.

## Clean-content hygiene

For a content measurement, scrub the .NET tool directories from the agent's PATH so `dotnet-inspect`
can't substitute for the skill set (tool availability is a separate lever). Scrub **both**
`~/.dotnet/tools` and `~/.dotnet/bin` — `dotnet-inspect` is commonly installed in both, and dropping
only one leaves it reachable. Since `grounding` normally lives in `~/.dotnet/bin`, call it by absolute
path afterwards, and assert the scrub took effect before you spend anything on a run:

```bash
command -v dotnet-inspect && { echo "still on PATH"; exit 1; }
"$HOME/.dotnet/bin/grounding" run ...
```

Verify `di == 0` on the grounded arm in the table.

## Read the result

Datasets are regenerable outputs and are **not** written to any repo. They land in the grounding cache —
`$GROUNDING_DATA_DIR`, else `$XDG_CACHE_HOME/grounding`, else `~/.cache/grounding/` (override per run
with `--out`). The cache is per-machine; delete it freely and re-run.

```bash
grounding analyze        "$DATA/<unit>.<model>.json"   # full table (baseline + grounded)
grounding analyze --card "$DATA"/<unit>.*.json         # quality-card dump for the PR
```

The distilled card goes in the PR body; the prose summary may live in the bundle `README.md`. See the
[quality-card model](./quality-card-model.md) for the RETURN × EFFICIENCY interpretation and
[`grounding-lifecycle.md`](./grounding-lifecycle.md) for the two ship gates.

## Running elsewhere

There is no special "other machine" path — running eval is always "clone this harness, build
`skill-validator` for the platform, point `--root` at the target repo." Datasets are machine-local and
regenerable, so each machine produces its own cache; only the inputs (in the target repo) and the
distilled card (in the PR) are shared.
