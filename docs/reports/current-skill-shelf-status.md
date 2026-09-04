# Current SKILL.md shelf evidence

**Date:** 2026-09-04
**Scope:** the latest measured evidence for the Markout, System.CommandLine, and
System.Text.Json skill shelves.

The older per-package reports in this directory are frozen records from the `AGENTS.md` era. They
remain useful as experiment history, but they do not describe the current `SKILL.md` shelves or the
current `Fails < Satisfies < Delivers` quality card. This report is the cross-package status page
for the newer work.

## Read this table as evidence maturity, not a leaderboard

The packages were measured with different instruments and at different methodology stages. A
larger uplift on one package does not make it a better shelf than another package's smaller uplift.
It usually means the ungrounded model knew less about that package.

| Package | Latest full-suite result | What the result establishes | Current limitation |
| --- | --- | --- | --- |
| Markout | Active CT-24, Haiku, `k=5`, explicit Delivers grading | Mean Delivered yield improved 0.575 → 0.842 and do-no-harm is clean | The Total-IET point ratio is ×0.83, but its 95% upper bound is ×1.02, so the current economic gate does not clear |
| System.CommandLine | Preview.7 CT-24, GPT-5.6 Luna/Terra/Sol, `k=5`, upstream Vally | Model-specific deterministic cards: Luna 69→103, Terra 79→106, and Sol 100→106 Delivered runs | The candidate needs finite-value routing and base-skill revisions before upstream; Sol costs 9% more on shared work |
| System.Text.Json | Current CT-24, Haiku, `k=5`, explicit Delivers grading, doc-stripped | Mean Delivered yield improved 0.767 → 0.833; strictness and migration carry the return; do-no-harm is clean | Shared reliability includes zero and Total-IET is ×1.02 [×0.93, ×1.12], so no current economic certification |

## Markout

### Current active-suite recertification

The merged shelf was remeasured after the active fixtures moved to Markout 0.35.2 and CT01–24
received explicit `Fails < Satisfies < Delivers` contracts. The run used Haiku for five runs per
task and arm, holistic pull delivery, and a fresh five-run baseline.

The admissible replacement ran under a dedicated, filesystem-locked evaluation home. All 360
recorded sessions completed; attempted global tool installs failed, and both isolated and host
NuGet/tool state remained unchanged. It supersedes the withdrawn provisional run.

| Model | Mean Delivered yield | Reliability `ΔP \| both` | Total-IET gate | Levelized geo | Duration geo | Do-no-harm |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Haiku | 0.575 → 0.842 | +0.235 [+0.064, +0.249] ✅ | ×0.83 [0.63, 1.02] ⛔ | ×0.44 [0.40, 0.72] | ×0.72 [0.60, 0.89] | loss 0.600 vs null 3.400 ✅ |

The shelf produced 101/120 Delivered replicates versus 69/120 for the baseline. Twenty-three tasks
were productive in both arms, one was grounded-only, and none was baseline-only. The null-calibrated
do-no-harm gate is clean. The reliability interval excludes zero under both the uniform prior and
the Jeffreys sensitivity analysis.

Economically, the point estimate is useful but not certified. Median-delivered Total IET on the
23-task shared set moved from 2928.6k to 2430.0k (−17%), but the gate is margin-based: its 95% upper
bound must be at or below ×0.80. The observed upper bound is ×1.02. The lower geo-mean IET and
duration bands show a typical-task efficiency improvement, but neither substitutes for the additive
Total-IET gate.

Two tasks had yield regressions (CT08: 5/5 → 3/5; CT24: 5/5 → 4/5), both within the clean
suite-level null threshold. CT23 was the grounded-only productive task. Retrieval remains
stochastic: the base skill activated on all 24 tasks at least once and on 69/120 plugin replicates;
the expected companion skill was pulled on 23/24 tasks, with CT20 the miss.

This result supersedes the prior "remeasure next" status. It is evidence that the current shelf
improves return without detectable suite-level harm, but it **does not renew the economic
certification**.

### Prior three-tier snapshot

The earlier CT-24 quality card measured five runs per task and arm across three model tiers:

| Model | Mean yield | Reliability ΔP | Total-IET ratio | Levelized geo | Per-day duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| Haiku | 0.533 → 0.942 | +0.263 | ×0.25 [0.21, 0.35] | ×0.20 [0.18, 0.33] | ×0.28 |
| Sonnet | 0.775 → 1.000 | +0.191 | ×0.36 [0.30, 0.40] | ×0.26 [0.23, 0.35] | ×0.21 |
| Opus | 0.883 → 1.000 | +0.117 | ×0.44 [0.39, 0.47] | ×0.40 [0.35, 0.52] | ×0.38 |

All three tiers cleared do-no-harm and the current economic-materiality rule: the 95% upper bound
of the Total-IET ratio stayed below ×0.80. Opus reliability is prior-sensitive and should remain a
supporting rather than headline claim.

That card is now **historical evidence**, not a certification of the current shelf. It predates the
package-prefixed domain-skill rename and the adopter-driven guidance added for CT27–33, and its
active CT-24 contracts used the historical `Delivers ≡ Satisfies` proxy rather than an independently
measured fidelity tier.

### Focused adopter-driven additions

The later held-out work measured the marginal guidance before merging it:

| Scenarios | Previous shelf Delivered | Candidate Delivered | Mean all-run IET movement |
| --- | ---: | ---: | ---: |
| CT27–29: typed formatter, semantic inline code, context options | 6/15 | 15/15 | −59%, −59%, −74% |
| CT30–33: number format, `MARKOUT006`, child rows, emphasis + TSV | 15/20 | 19/20 | −64%, −22%, −26%, −38% |

These focused results justify the added content. They do **not** independently clear a suite-level
economic gate: each focused shared set is smaller than the required eight tasks. Pulling also
remained noisy, and Markout's packed package documentation can still self-ground the nominal
baseline. The focused figures should therefore be read as conservative marginal evidence, not as a
replacement full-suite card.

**Current disposition:** the shelf is return-positive and do-no-harm clean, but it does not clear
the current economic ship gate. Keep the historical and focused evidence visible, but do not claim
that the present shelf has a certified ≥20% Total-IET margin.

## System.CommandLine

The first accepted OpenAI/Vally matrix measured the production-identity six-skill shelf against
System.CommandLine `3.0.0-preview.7.26381.103`. Each of the 24 tasks ran five times in baseline and
grounded arms for each GPT-5.6 model. Only named deterministic graders reconstructed
`Fails < Satisfies < Delivers`; models were analyzed separately and were not pooled.

| Model | Delivered runs | Coverage (both / grounded-only / neither) | Fidelity | Shared Total-IET | Do-no-harm loss mass |
| --- | ---: | ---: | ---: | ---: | ---: |
| Luna | 69/120 → 103/120 (**+28.3 pts**) | 20 / 3 / 1 | 59.5% → 88.8% | **×0.81** | 0.800 |
| Terra | 79/120 → 106/120 (**+22.5 pts**) | 20 / 3 / 1 | 71.2% → 92.2% | **×0.95** | 0.200 |
| Sol | 100/120 → 106/120 (**+5.0 pts**) | 22 / 2 / 0 | 85.5% → 90.6% | **×1.09** | 0.600 |

The shelf is decisively useful to Luna and Terra. Sol has much less capability headroom and pays 9%
more IET on shared work, so the present shelf is not an all-model economic win. There was no
baseline-only productive task. Luna required nine model-local whole-`(task, arm)` infrastructure
repairs; Terra and Sol required none. Source attempts, repair attempts, canonical outputs, and hashes
were retained.

The task card identifies two candidate defects rather than a reason to broaden the shelf:

- **Finite known values:** `options-and-arguments` steered C10 and the C24 capstone toward a custom
  validator instead of the package's `AcceptOnlyFromAmong` surface. The custom C10 solutions rejected
  bad input correctly, but the source task's runtime assertion recognized only the package-generated
  "`not recognized`" message, so it collapsed a working alternative from `Satisfies` to `Fails`.
  C20 also pulled `options-and-arguments` consistently but the 3.x-specific skill inconsistently.
- **Equivalent current command composition:** two Sol C08 runs used valid collection initializers
  (`Subcommands = { ... }` or the command collection initializer) rather than the exact
  `Subcommands.Add` spelling. Behavior passed; only the convention-tier grader failed. This is an
  evaluator-fidelity caveat, not evidence that the produced CLIs were broken.

The natural-activation cards support these per-skill dispositions:

| Skill | Disposition | Evidence |
| --- | --- | --- |
| `system-commandline` | **Revise** | Strong Luna/Terra return, but no Sol return and shared IET ×1.27 on Sol; narrow the base to its core contract and routing |
| `system-commandline-options-and-arguments` | **Revise** | Pulled 66/74/74 times, including 44–52% of non-primary trials; finite-value guidance obscures the 3.x route and the simpler case-sensitive API |
| `system-commandline-net-3x-additions` | **Revise** | Strong +0.533/+0.400/+0.333 target-family reliability, but only 4/10/13 of 15 target pulls and weak C20 reliability |
| `system-commandline-subcommands-and-help` | **Ship** | Luna and Terra reach 25/25 with large return and low off-target pull; Sol's apparent C08 loss is valid alternate current syntax |
| `system-commandline-actions-and-invocation` | **Ship** | Grounded reaches 10/10 target runs for every model and adds Terra/Sol reliability; the dedicated-action contract remains distinct |
| `system-commandline-beta-to-ga-migration` | **Ship** | Grounded reaches 10/10 for every model, with 0/110 off-target pulls and material Luna/Terra efficiency gains |

These are candidate-level decisions, not an upstream-ready certificate. Revise the three named
skills, correct the C10 satisfy-tier assertion so it accepts any clear parse-time rejection, and
remeasure the changed shelf before opening the upstream pull request.

The previous stable-2.0.10 CT-18 Haiku result remains supporting evidence: it produced a large return
gain and no baseline-only productive task, but predated explicit Delivers grading, used only six
shared tasks, and addressed the base skill under a harness-only identity.

## System.Text.Json

The current package-prefixed shelf was remeasured after CT-24 received explicit
`Fails < Satisfies < Delivers` contracts. The fresh run used Haiku five times per task and arm,
holistic pull delivery, and the symmetric `doc-stripped-v3` package baseline.

| Scenario family | Baseline → grounded Delivered yield | Movement |
| --- | --- | ---: |
| Whole suite | 76.7% → 83.3% | **+6.7 pts** |
| .NET 10/11 strictness | 40.0% → 100.0% | **+60.0 pts** |
| Newtonsoft migration | 80.0% → 100.0% | **+20.0 pts** |
| Source generation / Native AOT | 86.7% → 100.0% | +13.3 pts |
| DOM / streaming | 53.3% → 66.7% | +13.3 pts |
| Base-skill scenarios | 77.8% → 73.3% | −4.4 pts |
| Converters and polymorphism | 100.0% → 85.0% | −15.0 pts |

The 120 replicates per arm produced 92 → 100 Delivers, 23 → 17 Satisfies, and 5 → 3 Fails.
Coverage was 21 both-productive tasks, two grounded-only tasks, one baseline-only task, and no task
unreached by both arms. Shared-task reliability moved +0.057, but its 95% interval
[-0.052, +0.129] includes zero.

The do-no-harm gate is clean: loss mass 1.600 versus the null-calibrated threshold 2.400. The
economic gate fails: Total-IET on the shared set is ×1.02 [×0.93, ×1.12], not a certified reduction.
The run recorded no web or NuGet-cache archaeology; both arms used the same disposable
documentation-stripped package cache.

The current conclusion is narrower and stronger than the historical one. Strictness, migration
defaults, and AOT configuration provide selective return; heavily model-resident base and converter
workflows do not establish broad reliability or cost value. The S10/S12 regressions are retrieval
misses, but their combined loss remains below the null-calibrated harm threshold and should not be
tuned from one card without new adopter evidence.

**Current disposition:** retain the targeted shelf, especially its strictness, migration, and AOT
guidance. Do not claim a general reliability improvement or economic certification.

## What is current, and what is still owed

1. **Markout now has the strongest current instrument**, and its fresh active-suite card is
   return-positive and do-no-harm clean, but the economic interval upper bound (×1.02) misses the
   ×0.80 certification threshold.
2. **System.CommandLine now has production-identity OpenAI/Vally evidence**: Luna and Terra have
   strong return, while Sol exposes base-shelf cost and fidelity regressions that must be revised
   before upstream.
3. **System.Text.Json has selective rather than general value**: its current retrieval-equivalent
   card is return-positive and do-no-harm clean, but reliability is unestablished and economics fail.

Another identical Markout run is not the highest-value next step. The point estimate already sits
near the economic threshold, while the paired finite-suite interval includes no material win.
Further work should first decide whether to change the delivery/activation design or accept
return-positive shelves without certified economic margins. System.CommandLine and System.Text.Json
do not need more content tuning from these cards alone.

## Evidence sources

- [Current Markout quality-card table](../recommendation.md#current-evaluation-frame)
- [System.Text.Json rebuilt-suite evidence](../authoring-principles.md#evidence-systemtextjson-unit)
- [System.Text.Json current explicit-Delivers recertification](https://github.com/richlander/dotnet-package-skills/pull/76#issuecomment-5323533387)
- [System.CommandLine stable CT-18 result](https://github.com/richlander/dotnet-package-skills/issues/58#issuecomment-5281623282)
- [Markout CT27–33 focused evidence](https://github.com/richlander/markout/issues/149#issuecomment-5299227386)
- [Markout active CT-24 explicit-Delivers recertification](https://github.com/richlander/markout/issues/149#issuecomment-5313885872)
- [Baseline package-documentation contamination](https://github.com/richlander/dotnet-package-skills/issues/49)
