# The measurement harness

> **New here?** This doc explains how the repo runs repeatable evals: what gets built, what data
> is produced, and where each metric comes from. For **how we now grade and ship**, read the
> ratified **[quality-card model](./quality-card-model.md)**: return + efficiency, with do-no-harm
> and ≥20% economic-win gates.

How this repo **builds and runs** the [`dotnet/skills`](https://github.com/dotnet/skills)
`skill-validator` to measure whether grounding helps. [`overview.md`](./overview.md) covers *what*
grounding is and why it is measured this way; this file covers *how* the evals run.

> The harness scaffolding — generated plugin manifests, transient validator wrappers, slug rules,
> and runner scripts — is **not** shipped grounding. The artifact under test is the package skill set
> rooted at `skills/<slug>/SKILL.md`: a small base skill, optional domain skills and supporting
> files, and pull-based install into the consuming repo.

## Metrics vs. signals: what a claim may rest on

The study reads two epistemically different kinds of data, and we keep them strictly separated — the
analyzer (`grounding analyze`) even prints them in two labeled column groups. Conflating them is the
easiest way to overclaim.

**Normative metrics** are the quantities we are *allowed to draw conclusions from* — the actual value
delivered or harm incurred:

- **RETURN**: graded yield on the `Fails < Satisfies < Delivers` ladder, plus reliability as ΔP on the
  shared-success set.
- **EFFICIENCY**: cost over delivered runs. Per-dollar IET cost is the gate metric; per-day duration is
  a co-headline, not a gate.
- **Validity**: the do-no-harm gate checks loss mass against a null-calibrated threshold. The
  economic-materiality gate requires the per-dollar cost-ratio band upper bound to be ≤ ×0.80, certifying
  at least a 20% cost cut.

A headline like "grounding is cheaper and at least as correct" may rest **only** on these metrics.

**Informative signals** are everything about *how* the agent behaved: total tool calls, **reasoning
turns** (`turnCount` — iterations of the think→act loop, the cleanest measure of flailing),
`web_fetch`/`web_search`, `dotnet-inspect` invocations, NuGet-MCP calls, NuGet-cache rummaging, and bash
retry loops. **A tool call (or turn) is not itself a cost or a harm** — on its own it adds nothing to the
bill, and "fewer tool calls" is not a result we claim. Their value is **interpretive**: token spend is a
single point, but many signal points together trace the *narrative arc* — web archaeology,
cache-reflection, compile-retry flailing — that **explains why** the normative metrics move. Signals
corroborate and give shape to a claim; they are never the claim.

So when a baseline burns 6× the IET of a grounded arm, the **IET** is the finding; the 74 reasoning
turns, the 25 web fetches, and the cache pokes are the *story* of where those tokens went. Cite signals
to explain a metric, never in place of one.

A third kind of data is the **experimental parameter** — the size of the intervention itself. The
analyzer reports **grounding ~tok** (the `SKILL.md` content loaded into each grounded arm) per subject,
so payoff can be read *against* the grounding budget. Grounding tokens are not a result either; they are
the x-axis the metrics are plotted against.

## A confound: the baseline can read the package from the NuGet cache

The "baseline" arm is meant to be *ungrounded* — model knowledge only, web blocked. But a scenario
references a real package, so `dotnet build`/`run` restores it into `~/.nuget/packages`, and the agent's
`bash` can read whatever the package **ships on disk**. That can include the package's `README.md`,
other package docs, and the `lib/*.dll` (reflectable/decompilable). So the web-blocked baseline is not
necessarily pure model knowledge — it can self-serve shipped package material straight from the restored
cache.

This is empirically active, not hypothetical. In the Markout n=3 runs (package `Markout 0.13.8`, whose
cache entry ships package docs), the **baseline** read those files from the cache. Attributing every
session to its arm via `sessions.db` and counting only *successful* tool results, the **baseline** arm
made **28 successful reads** of cached package docs across its 18 sessions (6 scenarios × 3 runs); the
grounded arms made **0** cache-path reads — they receive grounding through the skill mechanism, not the
cache. (An earlier coarse `grep` of the path string across all session logs reported 304/98; that
over-counted — one read spans many log lines — and conflated arms. The per-arm, success-aware figure is
28 baseline reads.) The consequence: for a package that ships useful docs, **the baseline-vs-grounded gap
understates grounding's value**, because the baseline already had a fraction of the needed context on
disk.

**Docs inside the nupkg are extracted by restore.** `Markout 0.13.8`'s nupkg contains package docs at
the package root (declared via `<PackageReadmeFile>` / `<None Pack>`). Verified directly: starting from a
*completely empty* `NUGET_PACKAGES` dir, a single `dotnet restore` of the package re-materializes those
files on disk. This has a sharp implication: **you cannot have the package restored (buildable) without
its shipped docs being readable** — the docs travel with the code. Since every Markout scenario asserts
`dotnet build`/`run`, the agent's own build necessarily restores the package and lands the docs in the
cache. So in any build-based scenario the web-blocked baseline is **never truly empty of package
context**.

That makes only two baseline conditions physically meaningful:

1. **Warm / restored** — the only condition compatible with build-based scenarios. The package and its
   shipped docs are on disk; the baseline competes against package-cache context, not against model
   ignorance. **Every number in this repo is this condition.**
2. **Cold / no-restore** — a truly empty cache where the package is never restored. Here the baseline
   has model knowledge only. But this is only achievable for **advisory scenarios that never build**;
   the moment a task requires `dotnet build`, restore warms the cache and condition (1) returns.

The current pull-based skill set is installed into the consuming repo and is removable; it is not an
always-on file packed into the package. The cache confound above is therefore about ordinary package
materials already shipped in a nupkg, not about the live grounding delivery mechanism.

### Why "empty NuGet cache" is not an eval state worth measuring

A reasonable question is whether the *starting* cache state — empty vs. pre-warmed — is its own
experimental variable. For build-based scenarios it is **not**, and we deliberately do not measure it.
The agent restores the package itself, almost immediately, as a natural first step toward the task.
Empirically, across all **18** Markout baseline sessions (6 scenarios × 3 runs) the agent's first
`dotnet build`/`restore` landed at tool-call **#5–11**, and **every** cache-doc read happened *after*
that first build — in **0/18** sessions did the baseline read a package doc before restoring. So an
empty starting cache collapses to the warm condition within the agent's first few actions; it cannot
persist through a build-based run. Measuring "empty cache at t=0" would therefore measure a transient
that the agent erases before it does any package-specific work — the package is effectively *always
present* by the time it matters. The only setup in which an empty cache is a stable, observable state is
an advisory task that never builds, which is condition (2) above. Treat starting cache state as fixed
(warm), not as a variable.

Stripping the docs out of a *restored* cache entry (lib kept) is therefore an **artificial third state**
that corresponds to no real developer setup — you would never have a restored, buildable package on disk
with its `README.md` surgically deleted. It is useful only as an upper-bound probe of "how much does
denying the cached docs cost the baseline," not as a realistic ungrounded baseline.

NuGetFetch `0.6.2` ships **no** docs in its nupkg (only the DLL), so its baseline leak is reflection
only (weaker) — which is itself a reason the NuGetFetch baseline looks stronger relative to grounding
than Markout's.

**The doc-strip probe (Markout `0.13.8`, n=3 matched).** As an upper-bound probe we relocated the
`0.13.8` docs out of the cache (lib kept) and re-ran the baseline. Method note: a HOME-redirected
isolation harness **does not work** — the Copilot CLI's auth state is HOME-bound, so a redirected
`HOME` fails with `Not authenticated`; the working approach (`.tools/baseline-cache-clean.sh`,
gitignored) keeps the real `HOME` and relocates only the doc files with a checksum-verified restore
trap. Stripping `0.13.8` dropped the baseline's successful cache-doc reads from **28 → 1**: the single
survivor was the agent **falling back to a sibling cached version** —
`cat .../0.13.8/README.md || cat .../0.13.7/README.md` — proving that stripping one version is *not* a
cold cache (the global cache here held five Markout versions: 0.10.2, 0.13.7, 0.13.8, 0.13.9, 10.0.2,
four of them shipping a README). The effect on the baseline arm (mean / 6 scenarios):

| baseline (n=3) | quality | cost | iet |
| --- | --- | --- | --- |
| WARM (docs cached) | 4.23 | 11.75 | 51,951 |
| doc-stripped (0.13.8) | 4.05 | 11.24 | 47,937 |
| **delta** | **+0.18** | +0.51 | +4,014 |

So denying the baseline the `0.13.8` docs cost it **~0.18 quality** (a *lower bound* — sibling-version
READMEs still leaked); cost/iet moved within noise. Bottom line: the published baseline-vs-grounded gap
**understates** grounding, and the understatement scales with how much useful material the package
ships. (`.tools/baseline-cache-test.sh` is an earlier HOME-isolated variant kept only for reference — it
is blocked by the auth issue above.)

## Run, session, and dataset artifacts (per-run vs aggregate)

The eval produces data at three levels. Knowing which artifact is authoritative for which metric is
essential — conflating them caused a real bug (tool-call counts read as single-run samples in a
runs > 1 study).

| Level | Unit | Where | Nature |
| --- | --- | --- | --- |
| **Session** | one (scenario, arm, **run**) execution | `sessions/<id>/session-state/events.jsonl`; a row each in the `sessions` (id → scenario/role/run mapping) and `run_results` (per-run `metrics_json`) tables | **Per-run source of truth — complete** (full events, *with* tool arguments) |
| **`sessions.db`** | all sessions of one eval | `<results-dir>/<timestamp>/sessions.db` | Complete, per-run; **ephemeral / regenerable** |
| **Dataset** | one eval | `results.json` (copied to the data cache) | **Aggregate summary** — the N runs collapsed per (scenario, arm) |

`results.json` is an *aggregate*. skill-validator collapses the runs per (scenario, arm): **token and
turn** fields are properly **averaged** (faithful), but for **runs > 1** the embedded **`events` is the
last run only** and **`toolCallBreakdown` is the first run only** — lossy, single-run remnants from the
collapse. The session data itself is never incomplete; the *aggregate* is.

**Rules:**

- **Never derive per-run / event-based metrics** (tool-call counts, nuget archaeology, tool-turn
  activity) from `results.json`'s embedded `events` when `runs > 1`. It is not the per-run truth.
- **`sessions.db` is the per-run source of truth.** `grounding run` post-processes it to compute
  per-run-**averaged**, event-derived stats and bakes them into the dataset as `metrics.toolStats`
  (`grounding enrich <dataset> --results-dir <dir>` backfills existing datasets). The analyzer prefers
  `toolStats`; the single-run embedded `events` is only a fallback for old, un-enriched datasets.
- **The dataset is the durable, self-sufficient analysis artifact** (no `sessions.db` needed at analyze
  time). **`sessions.db` is the regenerable source**, discarded with the results dir.

**Why read `sessions.db` and not the raw `events.jsonl` files?** The events are *not* only in the db —
every run's full log is also in its own `events.jsonl` (with arguments). What the db uniquely provides
is the **mapping**: each session directory is named by an opaque hash id, and nothing in the log or its
path says *which scenario / arm / run* it is. That attribution — `session-id → (scenario, role,
run_index)` — lives only in the `sessions` table. So we open the db for the **mapping**, not because the
events live only there (`run_results.metrics_json` also holds each run's events pre-parsed, which is
convenient).

**Why bake stats into the dataset instead of reading the db at analyze time?** Because `grounding run`
copies `results.json` *out* to a separate cache location, decoupled from the (ephemeral) results dir — so
at analyze time the db may be gone. Enriching at run time, when the db is present, keeps the dataset
correct and self-contained. (The alternative — have skill-validator keep *all* runs' events in
`results.json` — removes the db dependency but bloats the file ~3× and needs a harness-fork change.)

## How it relates to dotnet/skills

We follow the same pattern `dotnet/skills` uses for its own evals: **build** the `skill-validator`
binary from source (`dotnet publish eng/skill-validator/src/SkillValidator.csproj`) and run it.
skill-validator is **not published to any NuGet feed** (not nuget.org, not GitHub Packages) —
`dotnet/skills` only builds it in-repo and publishes a rolling `--prerelease` nightly to a GitHub
Release. So we pin a commit in [`eng/skill-validator.sha`](../eng/skill-validator.sha) and build the
validator from it.

The pin tracks the **`holistic-harness` branch of
[`richlander/skills`](https://github.com/richlander/skills/tree/holistic-harness)**, not
`dotnet/skills` main. That branch carries three commits this study's protocol depends on and that
were never upstreamed: the `expected_skill` scenario prior, holistic eval mode with the isolated-arm
skip, and per-run outcomes persisted before averaging. Upstream **accepts `--eval-mode` and ignores
it**, so a pin at `dotnet/skills` main silently downgrades every run to legacy pairwise with a live
isolated arm, producing numbers that are not comparable to any published card and no warning that
anything changed. Both [`eng/run-evals.sh`](../eng/run-evals.sh) and the bump workflow now refuse a
pin whose `EvaluateCommand.cs` carries no `--eval-mode`.

"Taking updates" = rebase `holistic-harness` onto `dotnet/skills` main, then bump the SHA. The bump
is automated by [`.github/workflows/update-harness.yml`](../.github/workflows/update-harness.yml),
which opens a PR pointing at the latest `holistic-harness` commit.

## Shipped skill set vs transient validator wrapper

The package-authored grounding under test is a pull-based skill set rooted at the shelf's base skill,
`skills/<slug>/SKILL.md`. That base skill uses the Anthropic Agent Skills convention: YAML
frontmatter with `name` and a use-when `description`, followed by concise guidance and progressive
disclosure into domain skills or supporting files. The package can carry multiple domain skills, and
the set is installed into the consuming repo.

`skill-validator` still needs a runnable skill surface during eval. The harness may synthesize transient
plugin scaffolding or copy the skill set into the validator layout, then clean up after the run. Do not
confuse that runner scaffolding with the package's shipped grounding artifact.

## Layout

Two directories, two jobs. `skills/` is **what ships**: the shelf a consumer installs, and the
artifact the eval grades. `grounding/` is **how it is measured**: scenarios, fixtures, and results.
Nothing under `skills/` is needed to *run* the harness — it is the thing under test.

Each unit is named with a **lowercase-hyphen slug** (the skill-validator skill name rule), e.g.
`system-commandline` for `System.CommandLine`. The unit folder, `meta.yaml`'s `name`, and the base
skill's own directory all carry that slug; domain skills prefix it (`<slug>-<domain>`) so names stay
unique across every package a consumer installs — see
[authoring principles](./authoring-principles.md#naming-derive-every-skill-name-from-the-package-id).
The real package id is recorded in `meta.yaml` (`package:`).

### In a package repo

This is the shape a package author adopts. The shelf sits at the repo root, beside the source it
documents, and ships from there. The eval bundle sits apart:

```text
skills/
  <slug>/SKILL.md      # base package skill; source of truth for the grounded arm
  <domain>/SKILL.md    # domain skills and progressive-disclosure support files
  plugin.json          # installs the set together
grounding/<slug>/
  meta.yaml            # name (== <slug>), package, description
  eval.yaml            # CT-24 scenarios: prompt + setup.copy_test_files + assertions
  fixtures/...         # sample project(s) copied into the agent workdir; gated by `dotnet test`
```

[markout](https://github.com/richlander/markout) is the worked example. Evaluate it from here with
`grounding run markout --root ~/git/markout`.

### In this repo

We host grounding for packages we do not own, so there is no single shelf to put at the root. Each
unit vendors its own copy inside the eval bundle:

```text
grounding/<slug>/
  skills/
    <slug>/SKILL.md      # base package skill
    <domain>/SKILL.md    # domain skills and progressive-disclosure support files
    plugin.json          # installs the set together
  meta.yaml
  eval.yaml
  fixtures/...
.dotnet-install/
  .dotnet-install.json   # advertises the `grounding` tool so `dotnet-install` can build it
eng/
  skill-validator.sha    # pinned dotnet/skills commit we build the validator from
  grounding              # launcher for the C# grounding CLI (run, gen-plugins, analyze, ...)
  run-evals.sh           # builds skill-validator from the pinned SHA, then runs evaluate
```

`grounding run` accepts either shape: it prefers `grounding/<slug>/skills/` and falls back to a root
`skills/`.

Fixtures always live under the eval bundle, never beside the shelf, so the baseline arm receives
task setup and never the grounded skill set.

### Not every folder is a full unit

- **Full units** carry a shelf, `eval.yaml`, and fixtures: `system-commandline`, `system-text-json`,
  `markout-013`.
- **Shelf only** — `markout`, `microsoft-extensions-ai`, `nugetfetch`, `prefer-dotnet-inspect` have
  a shelf and `meta.yaml` but no eval bundle. Markout's eval lives in its own repo and runs with
  `--root`; the others are authored shelves still waiting on one.
- **Channel-matrix arms** — `*-mcp`, `*-readme`, `markout-broadskill`, `multi-package-*` are flat
  `SKILL.md` + `meta.yaml` bundles from the historical delivery-channel study, not skill shelves.
  See [`docs/recommendation.md`](recommendation.md).

## Prerequisites

- A **.NET SDK** matching `dotnet/skills`' `global.json` (the harness builds `skill-validator` from
  a pinned commit).
- `git`, and **`gh auth login`** (`skill-validator`'s Copilot SDK uses your `gh` credentials).
- A **C toolchain** (`clang` + `ar`) if you install the Native AOT build — Native AOT needs a linker
  anyway, and the static SQLite step compiles the amalgamation. On macOS this is the Xcode Command
  Line Tools.
- *(optional)* `dotnet-inspect` for library inspection, but **not** for clean content runs (see
  [Keeping content arms tool-clean](#keeping-content-arms-tool-clean)).

## Build and install the `grounding` CLI

The CLI is in `src/grounding/` (`System.CommandLine`, net11.0). It is **not yet on a public feed**, so
build it from this repo. Pick the path that suits you:

```bash
# A. Run without installing (dev inner loop) — build once, forward args:
eng/grounding --help                       # bash;  eng/grounding.ps1 for PowerShell
# or run the built dll directly (any OS, no WSL):
dotnet build src/grounding -c Release && dotnet src/grounding/bin/Release/net11.0/grounding.dll --help

# B. Install as a global tool (framework-dependent; easiest, fully cross-platform):
dotnet pack src/grounding -c Release
dotnet tool install -g --add-source src/grounding/nupkg dotnet-package-grounding
grounding --help                           # runs via the dotnet host

# C. Install the Native AOT binary on PATH (self-contained single file, no dotnet host needed):
dotnet tool install -g dotnet-install       # one-time, if you don't have it
dotnet-install .                            # reads .dotnet-install/.dotnet-install.json
grounding --help
```

> **FDD vs AOT:** option **B** packs a conventional framework-dependent global tool (run via `dotnet`);
> option **C** produces a single native executable with no managed-host dependency. Both install a
> `grounding` command on PATH — use one. AOT is gated to publish, so plain `build`/`pack`
> stay fast and framework-dependent. Once published to a feed,
> `dotnet tool install -g dotnet-package-grounding` will work directly.
>
> **Why `dotnet-install` and not a copy script:** it installs to `~/.dotnet/bin`, which is on PATH
> but *not* the SDK's tool store (`~/.dotnet/tools`). Foreign files dropped into the tool store get
> pruned by later `dotnet tool` operations — the binary silently disappears mid-run. `dotnet-install`
> also refuses anything that isn't a single file, which is why `src/grounding/e_sqlite3-static.targets`
> compiles SQLite into the binary instead of shipping a `libe_sqlite3.dylib` sidecar.

## Run locally

```bash
# Prereq: a .NET SDK matching dotnet/skills' global.json, git, and
# `gh auth login` (skill-validator's Copilot SDK uses gh creds).
grounding run system-commandline --source skill --eval-mode holistic --runs 5 \
  -m "claude-haiku-4.5 claude-sonnet-5 claude-opus-5"
```

`run-evals.sh` clones the harness fork (`SKILL_VALIDATOR_REPO`, default `richlander/skills`) at the
pinned SHA into `./.tools`, builds `skill-validator`, and
caches it per-SHA, so only the first run pays the build cost. Package repos may also provide their own
`run.sh` / `run.ps1` wrappers around the same command.

### Keeping content arms tool-clean

For a clean **content** measurement the agent must not substitute a tool for the skill set, so eval runs
**scrub `~/.dotnet/tools` from the agent's PATH** (removing `dotnet-inspect`, `ildasm`, `ilspycmd`) while
keeping the system `dotnet`/`dnx`. Tool availability — e.g. a `dotnet-inspect` pointer — is a **separate
lever**, layered in deliberately as its own arm, not part of the baseline-vs-grounded content comparison.
(Verify post-hoc: the `di` signal in `grounding analyze` must be `0` on the grounded arm.)

## Adding a package

In this repo, under `grounding/<slug>/`; in a package repo, with the shelf at the root instead (see
[Layout](#layout)).

1. `skills/<slug>/SKILL.md` — the base package skill.
2. `skills/<domain>/SKILL.md` and support files — optional domain skills, plus
   `skills/plugin.json` to install the set together.
3. `meta.yaml` — `name` (== `<slug>`), `package`, `description`.
4. `eval.yaml` — CT-24 scenarios.
5. `fixtures/...` — task fixtures with a `dotnet test` or `dotnet run` correctness gate.
6. Run `grounding run <slug> --source skill --eval-mode holistic --runs 5`.

## Channel-matrix runs

The historical delivery-channel study (raw package → NuGet MCP → resident-index MCP) is driven by
[`eng/run-channel-matrix.sh`](../eng/run-channel-matrix.sh) and summarized by `grounding channels
extract`. It is delivery archaeology, not the live ship path. See
[`docs/recommendation.md`](recommendation.md) for the results and [`data/README.md`](../data/README.md)
for the channel definitions.
