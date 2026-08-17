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
| System.Text.Json | CT-24, Haiku, `k=5` | Targeted return value on post-training strictness APIs; broad migration/AOT guidance is model-resident | The run predates the package-prefixed skill rename and explicit delivers-tier grading; no current economic card was produced |

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

The rebuilt, hint-free CT-24 suite measured Haiku five times per scenario:

| Scenario family | Baseline → grounded | Movement |
| --- | --- | ---: |
| Whole suite | 77.5% → 86.7% | **+9.2 pts** |
| Newtonsoft migration | 100% → 100% | +0.0 pts |
| Source generation / Native AOT | 100% → 100% | +0.0 pts |
| .NET 10/11 strictness | 30% → 70% | **+40.0 pts** |
| Base-skill scenarios | 78% → 92% | +14.0 pts |
| Converters and polymorphism | 86.7% → 80.0% | −6.7 pts |

The result supports a narrow authoring conclusion: famous migration defaults and loud AOT failures
are already recoverable, while silent, post-training strictness APIs create real shelf value. The
small converters movement covers only three scenarios and is not evidence of a durable regression.

This run predates the package-prefixed skill rename, which changes what the agent sees during
retrieval. It also predates explicit delivers-tier contracts and did not produce a current
Total-IET quality card.

**Current disposition:** retain the targeted shelf, but describe the evidence as return-only and
topic-specific. A new full run is needed before making a current-shelf ship-gate claim.

## What is current, and what is still owed

1. **Markout now has the strongest current instrument**, and its fresh active-suite card is
   return-positive and do-no-harm clean, but the economic interval upper bound (×1.02) misses the
   ×0.80 certification threshold.
2. **System.CommandLine has the strongest return evidence**, but its six-task shared set is too thin
   for the current economic gate.
3. **System.Text.Json has selective rather than general value**, and its latest full run is not
   retrieval-equivalent to the current renamed shelf.

Another identical Markout run is not the highest-value next step. The point estimate already sits
near the economic threshold, while the paired finite-suite interval includes no material win.
Further work should first decide whether to change the delivery/activation design or accept a
return-positive shelf without a certified economic margin. System.CommandLine does not need more
content tuning to establish return, and System.Text.Json should be rerun only when a current ship
decision requires it.

## Evidence sources

- [Current Markout quality-card table](../recommendation.md#current-evaluation-frame)
- [System.Text.Json rebuilt-suite evidence](../authoring-principles.md#evidence-systemtextjson-unit)
- [System.CommandLine stable CT-18 result](https://github.com/richlander/dotnet-package-skills/issues/58#issuecomment-5281623282)
- [Markout CT27–33 focused evidence](https://github.com/richlander/markout/issues/149#issuecomment-5299227386)
- [Markout active CT-24 explicit-Delivers recertification](https://github.com/richlander/markout/issues/149#issuecomment-5313885872)
- [Baseline package-documentation contamination](https://github.com/richlander/dotnet-package-skills/issues/49)
