# Current SKILL.md shelf evidence

**Date:** 2026-08-16  
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
| System.CommandLine | adopter-derived stable-2.0.10 CT-18, Haiku, `k=5` | Large return gain with no baseline-only productive task | The shared cost set is only six tasks, the run predates explicit delivers-tier grading, and the harness-required base-skill identity differs from shipping |
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

The current stable shelf was rebuilt from two real adopters and measured on an 18-task
System.CommandLine 2.0.10 suite:

| Quantity | Baseline | Rewritten shelf | Change |
| --- | ---: | ---: | ---: |
| Equal-weight mean task yield | 0.144 | 0.711 | **+0.567** |
| Both-productive tasks | 6 | 6 | shared efficiency set |
| Grounded-only productive tasks | — | 12 | capability unlocks |
| Baseline-only productive tasks | 0 | — | no capability loss |
| Reliability `ΔP \| both` | — | — | +0.267, 95% CrI [+0.146, +0.476] |

The do-no-harm result is clean. The rewritten shelf adds dedicated action classes, stable compound
option contracts, and explicit-presence command validation that the baseline did not recover.

The run also reduced Total IET on the six shared productive tasks from 1757.9k to 766.1k (−56%) and
shared-task duration from 7411s to 2597s (−65%). Those are useful directional economics, but the
current quality-card rule requires at least eight shared tasks. Under today's method, the
System.CommandLine economic axis is therefore **not estimable**, even though the older levelized-IET
gate cleared when the result was first recorded.

The candidate body matched the shipping shelf, but the harness addressed its base skill as
`system-commandline-stable-2x` instead of the shipping `system-commandline`. The content result is
strong; retrieval behavior is not an exact production-identity measurement.

This stable CT-18 result supersedes the earlier preview-3.x CT-24 headline (11.7% → 65.0%). The
preview suite remains useful authoring history, not the current package recommendation.

**Current disposition:** keep shipping the stable shelf for its decisive return gain. Do not claim a
currently certified economic win until a measurement produces a sufficiently large shared set.

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
2. **System.CommandLine has the strongest return evidence**, but its six-task shared set is too thin
   for the current economic gate.
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
