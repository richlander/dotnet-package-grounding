# Does System.Text.Json need agent grounding? A measured answer

**Package:** `System.Text.Json`
**Date:** 2026-06-19
**Status:** Findings complete. Recorded as a cross-package validation of the methodology
developed for the System.CommandLine unit.

## TL;DR

System.Text.Json (STJ) **does not need general agent grounding.** We probed the topics most
likely to hide a non-resident knowledge gap — Newtonsoft→STJ migration, the case-sensitivity
default difference, and the Native AOT source-generation requirement — and **none cleared the
10% improvement bar** against a strong frontier model.

- **Newtonsoft→STJ case-insensitivity** (STJ is case-sensitive by default; Newtonsoft is
  not): **−12.5%**. This is the single most-cited STJ gotcha, so the model already guards
  against it. *Silent but famous → model-resident.*
- **System.Text.Json × Native AOT** (reflection-based serialization is disabled under
  `PublishAot`, requiring a `JsonSerializerContext` source generator): **+7.9%**. The
  baseline *objectively fails the task*, and grounding fixes it — real value — but the break
  is **loud** (it throws a self-describing exception at run time), so the model recovers to
  equal quality and the measured gain stays under the bar. *Non-resident but loud → real,
  sub-threshold value.*

**Recommendation:** do **not** ship a general STJ `AGENTS.md`. If any STJ content is ever
worth shipping it is the **Native AOT → source-generation** pattern (the one topic with
demonstrable fail→pass value), but it will not move the headline metric because the runtime
announces its own fix.

## Why measure instead of assert

Every line an agent reads competes for context, and most STJ API guidance is already in the
model's training data. The only content worth shipping is content that **changes agent
behavior** on real tasks. So we treat each candidate gotcha as a hypothesis and **measure**
it: does an agent do better *with* the grounding than without, on a representative task, by a
meaningful margin? STJ is a deliberately hard test of the methodology — it is a mature,
heavily-documented, in-box library, so we *expect* most of it to be resident. The value of
the exercise is confirming the methodology can tell "resident" from "non-resident but loud"
from "silent and obscure."

## Methodology

### Harness

We used the [`dotnet/skills`](https://github.com/dotnet/skills) **skill-validator** harness
(pinned at commit `5d717dbdd1998cdf88e7542eef52c5517cbefdb9`). For each scenario it runs an
agent on the same task three ways and has an LLM judge score the results:

- **baseline** — no grounding.
- **skilled (isolated)** — the grounding content injected directly into context.
- **skilled (plugin)** — the grounding offered as a discoverable skill the agent must
  *choose to load and read* (the realistic delivery path).

A scenario "passes" when the **effective score = min(isolated, plugin)** ≥ the threshold
(default **10%**). The `improvementScore` is a weighted blend dominated by quality:
Quality 0.40 + OverallJudgment 0.30 = **70%**; all efficiency dimensions (tokens, tool-calls,
time) total only **10%**; task completion is **0.15**. Clearing the bar requires moving
**correctness**, not saving tokens.

### Model and target

- Agent and judge model: **Claude Opus 4.6** (single model; see [Threats to validity](#threats-to-validity)).
- Target: **System.Text.Json** in the `net10.0` shared framework (in-box; no package
  reference). Migration source: **Newtonsoft.Json 13.0.4**.
- Behavior gates are deterministic and network-free (the deserialized values must actually
  print; the AOT app must build *and run* with Native AOT enabled), giving the judge
  objective ground truth a compile-only check cannot.

## Scenarios and results

| # | Scenario | Baseline → Grounded (quality) | Improvement | Interpretation |
| --- | --- | --- | --- | --- |
| N1 | Migrate a Newtonsoft.Json CLI to STJ; camelCase JSON → PascalCase model with no attributes (silent break = STJ case-sensitive by default) | 5.0 → 4.8 (iso) / 4.0 (plugin) | **−12.5%** (runs=5) | Baseline reliably adds `PropertyNameCaseInsensitive`/`JsonSerializerDefaults.Web` itself. The most-cited STJ gotcha is **model-resident**. No signal. |
| N2 | Make a reflection-based STJ tool Native AOT compatible (`PublishAot=true` → reflection disabled → throws at run time; fix = `JsonSerializerContext` source-gen) | 5.0 → 5.0 (quality tied) | **+7.9%** (runs=5; iso +9.4%, plugin +7.9%) | **Baseline fails the task** (task-completion ✗ → ✓); grounding has real value. But the break is **loud** (self-describing runtime throw), so the model recovers to equal quality and the win is task-completion only — **under the bar.** |

(Both at `--runs 5`; N2 reported after leveling a verification confound — see Analysis. Full
artifacts in the appendix.)

## Analysis

### What the model already knows (skip it)

STJ's headline behavioral differences from Newtonsoft — case-insensitive matching, the
`JsonConvert`→`JsonSerializer` and `[JsonProperty]`→`[JsonPropertyName]` mappings,
ignored public fields, comment/trailing-comma handling — are **extensively documented and
heavily represented in training data.** A strong model writes the correct migration
unprompted. N1 confirms this: the case-sensitivity trap, despite being a genuine *silent*
break, produced **negative** signal because the model proactively guards against the single
most-blogged STJ pitfall. *Silent is necessary but not sufficient; the gap must also be
obscure.*

### The one real gap is loud, so it caps below the bar

The Native AOT requirement is genuinely **non-resident-adjacent**: it is post-training-stable,
and the baseline **objectively fails the task** (`taskCompletionImprovement = +1.0`; baseline
✗, grounded ✓). That is the strongest pro-grounding signal STJ produced. But it lands at
**+7.9%, under the bar**, for a structural reason:

```text
PublishAot=true → reflection-based JsonSerializer.Deserialize<T>(json) →
  build: warning IL3050 (not an error)
  run:   throws InvalidOperationException:
         "Reflection-based serialization has been disabled… use the source generator APIs."
```

Because the failure is **loud and self-describing**, an agent that builds and runs the app
reads the exception, recognizes the well-known source-generation pattern, and fixes it — so
the *final quality ties* between baseline and grounded (judge: tie/Equal). The only durable,
bar-relevant delta is the 0.15-weighted task-completion win, which nets +7.9% after the
plugin arm's discovery-token overhead. **A loud breaking change is recoverable by running;
grounding it buys task completion in the worst case and speed in the best, but not the
quality movement the 10% bar requires.**

### A measurement confound worth recording

N2's *first* run scored **−3.5%**, not +7.9%, even though the grounded arms passed the hard
gates the baseline failed. The cause was a **verification-visibility artifact**: the grounded
plugin agent wrote correct source-gen code but did not visibly *build and run* it, so the
pairwise judge preferred the baseline (which had verified its own work) on the "no warnings /
same output" rubric line. Adding one neutral sentence to the prompt — *"after your change,
build and run it to confirm the output"* — leveled both arms, the quality tie returned, and
the score moved **−3.5% → +7.9%** (and variance fell from CV=1630% to CV=97%). This mirrors
the System.CommandLine finding that **delivery and verification parity matter as much as
content**, and it is a caution for anyone reading a single noisy run as a verdict.

## Conclusion

**Verdict: System.Text.Json does not need general agent grounding (claim #3).** Its
behavioral gotchas are either model-resident (case-insensitivity and the rest of the
Newtonsoft difference table) or non-resident but **loud** (Native AOT source-generation),
which the dev loop recovers. No probed topic clears the 10% improvement bar.

This is a *positive* result for the methodology: it discriminates cleanly between a package
that benefits from grounding (System.CommandLine: the silent-and-obscure alias-vs-description
break cleared the bar at **+15.1%**) and one that does not (System.Text.Json: nothing clears
it). The refined authoring rule that falls out of the two units:

> Ground a gotcha only if it is **silent** (compiles *and* runs without error but behaves
> wrong), **obscure** (rarely written about → genuinely non-resident), **and** not
> self-correcting at run time. System.Text.Json's strongest candidate fails the third test;
> its most famous one fails the second.

## Threats to validity

- **Single model.** All runs used Opus 4.6 as both agent and judge. A weaker model would
  likely find more STJ content non-resident (larger signal, especially for AOT). The *shape*
  of the conclusion should generalize; exact magnitudes will move.
- **High run-to-run variance.** N2 was CV=97% even after leveling the confound; N1's variance
  was also large. Treat magnitudes as soft and directional.
- **Threshold is a convention.** The 10% bar is the harness default. The qualitative ranking
  — resident vs. loud vs. silent-and-obscure — is the durable result.
- **AOT was simulated, not natively compiled.** We triggered the exact AOT runtime behavior
  via `PublishAot=true` (which sets `JsonSerializerIsReflectionEnabledByDefault=false` even
  for `dotnet run`), avoiding a multi-minute native compile. The thrown exception and IL3050
  warning are identical to a real AOT publish; the *measured* recovery behavior would be the
  same.

## Appendix: reproduction

- Harness: `dotnet/skills` skill-validator @ `5d717dbdd1998cdf88e7542eef52c5517cbefdb9`,
  built from source by `eng/run-evals.sh`.
- Run: `eng/run-evals.sh System.Text.Json` (or
  `skill-validator evaluate --tests-dir ./tests --runs 5 grounding/system-text-json`).
- Eval spec + fixtures: `tests/system-text-json/`.
- Versions: STJ in-box on `net10.0`; Newtonsoft.Json `13.0.4`.
- Result artifacts (`.skill-validator-results/`):
  - `20260619-155209` — N1 case-insensitivity, `--runs 5` (−12.5%).
  - `20260619-173119` — N2 Native AOT, `--runs 5`, pre-leveling (−3.5%, verification confound).
  - N2 Native AOT, `--runs 5`, verification-leveled prompt (+7.9%).
- Authoring principles distilled from this work:
  [`docs/authoring-principles.md`](../authoring-principles.md).
