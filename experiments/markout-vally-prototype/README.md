# Vally regime-faithfulness prototype

This is an additive prototype for answering one question: **can Vally faithfully execute the
existing Markout grounding regime?** It validates a successor execution plane without removing
`eng/run-evals.sh`, the current `skill-validator` harness, or the quality-card analyzer.

The repository now contains two execution surfaces:

- `eval.yaml` / `experiment.yaml`: the original three-scenario feasibility and control surface.
- `eval.ct24.yaml` / `experiment.ct24.yaml`: the generated complete CT-24 migration surface.

## Pinned experiment

- Vally CLI/core: `0.13.0`, source commit `f7a653272642d52b2b6375bfa3995dddc72fcd49`
- Agent: `claude-haiku-4.5`; no explicit reasoning effort because Copilot SDK rejects that field
  for Haiku, matching the historical CT-24 records
- Judge: `gpt-5.5`, reasoning effort `high` (pinned but unused by outcome grading)
- Markout package: `0.35.2`, official nupkg SHA-256 recorded in `pins.json`
- Package repository commit from the signed nuspec: `e2302d97c166aad0ef73a00d79bc50e8f228d379`
- Package closure: `MarkdownTable.Formatting 0.3.4`, with its official nupkg SHA-256
- .NET SDK: `10.0.300` with roll-forward disabled
- Markout fixtures and five-skill shelf: materialized from commit
  `e744d7ba3b13c6490bd3a660a4cc87f235f81918` and checked against separate content hashes
- Trials: fixed `k=5` per task and arm
- Arms: identical config except `environment.skills` (`[]` versus the complete pinned shelf)

The three scenarios are CT01 (base serializer), CT15 (built-in tree plus terminal formatter), and
CT18 (serialize-time conditional composition). They preserve the official Markout 0.35.2 prompts,
fixtures, and deterministic checks.

## Regime mapping

Vally executes the agent and deterministic graders. Explicit grader names carry the contract:

- `satisfies/*`: functional outcome checks
- `delivers/*`: taught-approach checks
- `harness/*`: run health, excluded from outcome classification
- `reject_tools`: web/archaeology discipline signal, reported separately and intentionally excluded
  from the functional ladder, matching the custom harness's `ToRunOutcome` and grounding loader

The control verifier and native `grounding` adapter reconstruct the ladder independently rather
than accepting Vally's aggregate verdict:

1. any failed `satisfies/*` grader -> **Fails**
2. every `satisfies/*` grader passes and any `delivers/*` grader fails -> **Satisfies**
3. every `satisfies/*` and `delivers/*` grader passes -> **Delivers**

`grounding vally task-card` emits one row per task: coverage cell, Delivered yield and reliability
delta, fidelity lift among working runs, do-no-harm loss, median-Delivered IET ratio, levelized IET
ratio, and median-Delivered duration ratio. The prototype invokes that native C# path through
`npm run analyze`; Vally does not own the methodology or final interpretation.

The C# adapter keeps Vally wire DTOs separate from the existing `skill-validator` aggregate DTOs
and preserves trial identity, variant, model, token/duration metrics, named grader results, and
`skillActivationBreakdown`. The pinned grader manifests require the exact task and top-level grader
set for every trial; missing, duplicate, renamed, unexpected, or type-mismatched graders invalidate
the dataset instead of upgrading its outcome. The adapter also fails closed on execution errors,
incomplete or noncontiguous arms, model/variant/item identity drift, and mismatched Vally eval
provenance.

This first migration slice deliberately stops at the task card. The next reporting slice is the
six-row observational per-skill card over the complete CT-24 shelf run. It requires a
pre-registered task-to-skill applicability map: activation is measured from the natural full-shelf
run, not treated as intended applicability, and a skill is not forced onto all tasks. Leave-one-skill
out remains a later causal confirmation rather than the primary quality-card input.

That reporting slice is now implemented as `grounding vally skill-card`. Its pinned applicability
contract is `applicability.markout-ct24.json`, derived from the authored `expected_skill` fields at
the pinned Markout source commit. The base `markout` skill applies to all 24 tasks because every
domain skill requires the base serialization pattern; each domain skill applies only to the tasks
whose authored prior names it.

Each skill card has exactly six rows:

1. **Retrieval** — run-level activation rate on intended tasks and false activation rate elsewhere.
2. **Coverage** — both / grounded-only / baseline-only / neither cells over intended tasks.
3. **Reliability** — Delivered yield change over every intended-task trial.
4. **Fidelity** — `P(Delivers | Works)` change over intended-task trials.
5. **Do no harm** — all-task loss mass, plus observational pull-coincident and off-target
   pull-coincident loss. Coincidence is not causal attribution.
6. **Efficiency** — median-Delivered Total-IET ratio over shared intended tasks, with levelized-IET
   and duration geometric-mean companions.

The report first renders the same six rows as a **shelf reference card** over all registered tasks.
Per-skill scopes overlap by design—the base skill is required by domain skills—so the skill cards
must be contrasted with that total card, never summed to reconstruct it. Use `--no-total` only when
extracting an already-understood individual card.

The command rejects partial shelves, mixed model classes, unequal or inconsistent `k`, missing
activation breakdowns, and incomplete outcome data. The three-task feasibility experiment therefore
cannot masquerade as a per-skill certification; this view is only valid for a complete registered
CT-24 Vally run.

## Commands

```bash
cd experiments/markout-vally-prototype
npm ci
npm run lint
npm run dry-run
npm test
npm run verify-controls
npm run lint:ct24
npm run dry-run:ct24
npm run smoke:ct24

# Executes 3 tasks x 2 arms x 5 fixed trials. Does not invoke Vally's LLM compare path.
npm run experiment

# Executes 24 tasks x 2 arms x 5 fixed trials (240 agent sessions).
npm run experiment:ct24

# Point at the timestamped directory written under results/.
npm run analyze -- results/<timestamp> --runs 5 --model claude-haiku-4.5

# After execution migration produces a complete CT-24 run:
npm run skill-card -- results/<ct24-timestamp> --runs 5 --model claude-haiku-4.5
```

## Complete CT-24 execution translation

`scripts/generate-ct24-eval.mjs` translates the first 24 scenarios from the pinned Markout
`grounding/markout/eval.yaml` into Vally's wire format. It preserves names, prompts, fixture
destinations, tool restrictions, timeouts, expected exit codes, output regexes, assertion tiers,
and negative file checks. The current source surface is exactly 98 `run_command_and_assert`
assertions plus 24 `file_not_contains` assertions; the generator rejects any other type, tier,
quoted command syntax, fixture count, task ordering, or applicability drift.

The generated output uses only `completed`, `run-command`, and `file-not-contains` graders.
`scripts/verify-ct24-spec.mjs` compares every generated stimulus and grader back to the pinned source,
and `pins.json` separately attests the source eval, all 48 CT-24 fixture files, generated Vally eval,
exact grader manifest, applicability map, shelf, package, and dependency closure.
The generated constraints also preserve every source `reject_tools` entry. Vally 0.13 does not
enforce or automatically grade those constraints, so the bridge reporter reconstructs the separate
discipline signal from trajectory tool calls; it does not alter Fails/Satisfies/Delivers.

`smoke:ct24` executes CT01 once without skills and once with the natural full shelf in the same
doc-stripped isolation used by the experiment. It checks that real Vally results contain token,
duration, grader, trial-identity, and `skillActivationBreakdown` data, then sends the paired records
through `grounding vally task-card`. This caught two dry-run-invisible incompatibilities:

- Copilot SDK rejects `reasoning_effort` for `claude-haiku-4.5`; the explicit field is omitted,
  matching the historical CT-24 records while preserving the pinned model.
- Vally 0.13 stores trial identity in `itemId` (`::trial-N`) rather than top-level
  `trialIndex`/`totalTrials`; the C# adapter accepts that actual wire shape and still enforces
  contiguous fixed `k`.

The full `experiment:ct24` command intentionally does not use Vally's LLM comparison report. Its
240-session result is interpreted only by the deterministic `grounding` task and skill cards.

The first production run completed on 2026-08-19 with run ID
`60cf27d7-3493-4aa1-a4fb-2e34532cac8c`: 120/120 baseline and 120/120 grounded sessions completed
successfully. Vally returned exit code 1 because its aggregate 100% threshold treats any legitimate
grader failure as a failed eval; the trial artifacts were complete and were analyzed independently.
The run wrapper now converts that specific exit into collection success only when a newly created
result directory matches the pinned manifest: the exact 24 tasks, five unique contiguous trials per
task and arm, successful executions, model and item identities, complete grader sets, token/duration
metrics, grounded activation data, and Vally eval provenance. Partial, uneven, mismatched, or
execution-failed runs remain nonzero.

The grounding readout was:

- Delivered yield: `44/120 → 119/120`
- coverage: 15 both-productive, 9 grounded-only, 0 baseline-only, 0 neither
- do-no-harm loss mass: `0.000`
- shared-task Total-IET ratio: `×0.39`
- levelized-IET geometric mean: `×0.20`
- duration geometric mean: `×0.38`

This proves that Vally emits the data needed to run the methodology, but not yet that its execution
plane is numerically interchangeable with the custom harness. The prior active-harness
recertification reported `69/120 → 101/120` on the same named model and suite, versus Vally's
`44/120 → 119/120`. Model labels do not pin a model snapshot, and the Copilot SDK executor, skill
delivery, workspace policy, or service-time model behavior may shift both arms. A replacement claim
therefore needs a contemporaneous bridge run across both execution planes; the Vally cards
themselves must not be normalized to the historical numbers.

`npm run bridge:custom` runs the pinned custom skill-validator fork against a local checkout of the
same Markout `e744d7b` source snapshot. It uses the Vally isolation bootstrap as the warm package
cache, then applies the custom runner's `doc-stripped-v3` copy, so both collectors see the same
pinned Markout package closure rather than the host's full NuGet cache. The custom harness still
requires its Haiku judge to emit `results.json`; that judgment is collection plumbing only and does
not participate in `Fails / Satisfies / Delivers`. A deterministic bridge overlay adds the pinned
.NET `10.0.300` `global.json` to every custom-harness trial; its transformed eval hash is pinned.
Without that overlay the host's .NET 11 preview SDK attempted to restore framework packs into the
read-only NuGet cache, so that contaminated bridge attempt was discarded.

## Contemporaneous execution-plane bridge and cutover

The replacement gate reran both collectors back-to-back against the same Markout commit, package
closure, five-skill shelf, Haiku model label, deterministic assertions, `k=5`, and doc-stripped
baseline. The corrected custom run completed first at `2026-09-02T20:41:26Z`; Vally started 53
seconds later. A prolonged DNS outage invalidated 38 baseline and 60 grounded Vally executions.
The repair policy was fixed before rerunning: replace all five trials for every affected task-arm
group, never selected outcomes. Eight baseline tasks and 14 grounded tasks were rerun; one baseline
CT23 repair trial then failed its harness-completion grader, so that complete five-trial group was
rerun once more. `bridge-results/vally/repair-manifest.json` records every source error, attempt,
replacement identity, and content hash. Canonical records carry their target-arm identity plus the
original standalone identity. The bridge reporter verifies the source, repair, canonical, eval,
grader-manifest, task, trial, and grader shape before comparing.

| Metric | Custom harness | Vally |
|---|---:|---:|
| Baseline Delivered | 46/120 | 37/120 |
| Grounded Delivered | 111/120 | 116/120 |
| Reliability lift | +0.542 | +0.658 |
| Grounded fidelity | 0.957 | 0.983 |
| Do-no-harm loss mass | 0.000 | 0.000 |
| Expected-skill retrieval | 110/120 | 109/120 |
| Any-skill retrieval | 117/120 | 119/120 |
| Rejected-tool calls / trial | 1.762 | 1.271 |
| Total-IET ratio | ×0.31 | ×0.34 |
| Levelized-IET geo | ×0.15 | ×0.17 |
| Duration geo | ×0.33 | ×0.36 |

The bridge supports **cutting over to upstream Vally plus this repository's adapters**. It does not
support treating custom-harness and Vally measurements as one numeric time series:

- retrieval, grounded fidelity, do-no-harm, Total-IET, levelized-IET, and duration ratios reproduced
  closely;
- Vally produced five more grounded Deliveries and nine fewer baseline Deliveries, so absolute
  Delivered yield and reliability lift remain execution-plane dependent;
- rejected-tool use remains a separate discipline measure in both planes rather than a ladder rung;
- the difference is expected to live in executor/system-prompt/tool behavior, not in the
  methodology—the prompts, fixtures, shelf, graders, ladder, and economics were held fixed.

Cutover policy:

1. New certification runs use upstream Vally as the execution/data plane and `grounding` as the
   methodology/reporting plane.
2. The cutover starts a new execution epoch. Never pool, trend, or normalize Vally trials with
   custom-harness trials; compare within one execution plane only.
3. Keep the pinned custom harness available solely to reproduce historical datasets until their
   retention window expires. It is not required for new measurements.
4. Keep isolation/provenance wrappers and deterministic reporters in this repository. A Vally fork
   is not required; stronger sandboxing can later arrive as an upstream backend/plugin.
5. Execute Vally certification only on a disposable, dedicated runner with no unrelated secrets and
   a short-lived Copilot transport token until an upstream backend can separate model credentials
   from agent-controlled tool subprocesses.

`verify-controls` sends nine preserved workspaces through Vally's actual deterministic graders:
for each task, a serializer-based positive control must classify **Delivers**, the untouched fixture
must classify **Fails**, and a hand-written opposing control with correct output must classify
**Satisfies**.

## Isolation and provenance gaps

The run wrapper creates a disposable `HOME`, restores the pinned official package, removes packaged
skills/readmes/XML docs, deletes the temporary package feed and bootstrap project, clears NuGet
sources, makes the isolated package cache read-only, and constructs an explicit child-environment
allowlist instead of inheriting host credentials. This prevents the baseline from recovering the
shelf from `~/.nuget/packages/markout/0.35.2/skills` and excludes unrelated cloud, package-registry,
signing, and shell credentials.

Remaining gaps are Vally platform gaps, not changes to the regime:

- Vally records eval/config content hashes, but it does not natively attest the external NuGet
  artifact, fixture corpus, or multi-directory shelf as one reusable provenance key. The bootstrap
  and `pins.json` provide that missing check.
- Markout 0.35.2's signed package points to commit `e2302d9`, while the explicitly requested current
  0.35.2 fixtures and shelf are pinned later at `e744d7b`. The prototype records both identities
  instead of pretending package, fixture, and shelf provenance are one commit.
- The local backend isolates workspaces but is not a filesystem or network sandbox. An agent can
  still attempt absolute-path discovery or network access through a shell tool. The Copilot token
  required by Vally is also visible to tool subprocesses because model transport and tools share one
  process environment. Certification therefore requires a disposable secret-free runner and a
  short-lived token; broader production use needs backend-enforced filesystem roots, outbound
  network policy, and transport-secret separation.
- Experiment-level `grader_plugins` and `executor_plugins` are parsed but not wired in Vally 0.13.0.
  This prototype therefore uses built-in deterministic graders and an external task-level reporter.
- Eval `reject_tools` constraints are validated structurally but are not enforced or automatically
  graded by Vally 0.13. The adapter can reconstruct the existing separate web-discipline signal from
  trajectory events; a native constraint-to-grader mapping would remove that reporting extension.
- Vally's default aggregate pass rate, pass@k/pass^k report, and optional LLM `compare` do not encode
  the Fails/Satisfies/Delivers ladder, paired task coverage, fidelity, do-no-harm, or levelized IET.
  A first-class reporter hook with access to all variants and trials is required to make the adapter
  native.
- Vally persists token and duration metrics needed for task-level IET, but it does not capture the
  current harness's null-calibrated loss threshold or nested task/run uncertainty model. Those
  remain analyzer extensions if this prototype advances beyond three tasks.

Required Vally extensions are therefore: provenance attestations for external inputs, enforceable
backend isolation/network policy, wired experiment plugins, and a cross-variant deterministic
reporter API. Until those exist, Vally can execute this regime only with the checked-in adapter and
wrapper; its default report is not a faithful substitute.
