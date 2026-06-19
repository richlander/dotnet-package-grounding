# Does System.CommandLine need agent grounding? A measured answer

**Package:** `System.CommandLine`
**Date:** 2026-06-19
**Status:** Findings complete; intended to support an upstream PR adding an `AGENTS.md`
to the package.

## TL;DR

System.CommandLine **does** benefit from agent grounding, but **only for a narrow set of
high-value topics** — not as general usage documentation. We measured agent performance
with and without grounding across five scenario shapes (greenfield authoring, new-member
discovery, and three migration variants). The result:

- General API usage, greenfield authoring, and "what's new in 3.x" are **model-resident**:
  a strong model already gets them right, so grounding shows **no signal** (−2.2% to +1.1%).
- Even migrating code off a **removed** API is *largely* model-resident, because the
  normal dev loop (compile errors + reflection) recovers the answer. Grounding bought only
  **efficiency** (+6.4%), below the bar.
- The **one durable, measurable gap** is a **silent breaking change** — code that compiles
  and looks correct but behaves wrong. For System.CommandLine the canonical case is the
  `Option<T>`/`Argument<T>` constructor whose **second positional argument changed from a
  *description* to an *alias*** between `2.0.0-beta` and GA. With grounding present this
  scenario reached **+15.1%** (gating arm), clearing the 10% improvement bar.

**Recommendation:** ship a short, dense `AGENTS.md` focused on **beta → GA/3.x migration
and silent gotchas**, not a comprehensive how-to. The proposed content is ~44 lines (see
[Proposed grounding content](#proposed-grounding-content)).

## Why measure instead of assert

It is tempting to write an exhaustive "agent guide" for a package. But every line an agent
reads competes for context, and most API guidance is already in the model's training data.
The only content worth shipping is content that **changes agent behavior** on real tasks.
So we treat each candidate section as a hypothesis and **measure** it: does an agent do
better *with* the grounding than without, on a representative task, by a meaningful margin?

## Methodology

### Harness

We used the [`dotnet/skills`](https://github.com/dotnet/skills) **skill-validator** harness
(pinned at commit `5d717dbdd1998cdf88e7542eef52c5517cbefdb9`). For each scenario it runs an
agent on the same task three ways and has an LLM judge score the results:

- **baseline** — no grounding.
- **skilled (isolated)** — the grounding content injected directly into context.
- **skilled (plugin)** — the grounding offered as a discoverable skill the agent must
  *choose to load and read* (the realistic delivery path).

### The improvement metric

The harness produces a single `improvementScore` per scenario: a weighted blend of seven
dimensions (from the harness's `DefaultWeights`):

| Dimension | Weight |
| --- | --- |
| Quality (rubric / pairwise judge) | **0.40** |
| Overall judgment (pairwise winner) | **0.30** |
| Task completion | 0.15 |
| Token reduction | 0.05 |
| Error reduction | 0.05 |
| Tool-call reduction | 0.025 |
| Time reduction | 0.025 |

Two consequences drive everything below:

1. **The bar is quality-dominated.** Quality + overall judgment = **70%** of the score.
   All efficiency dimensions (tokens + tool-calls + time) total only **10%**. Clearing the
   bar therefore requires moving **correctness**, not saving tokens.
2. **Delivery is gated.** A scenario "passes" when the **effective score = min(isolated,
   plugin)** ≥ the threshold (default **10%**). So the grounding must be both *useful* and
   *retrievable*: if the agent doesn't load it, the plugin arm — and thus the verdict —
   stays low.

### Model and target

- Agent and judge model: **Claude Opus 4.6** (single model; see [Threats to validity](#threats-to-validity)).
- Target package: **System.CommandLine 3.x** = `3.0.0-preview.5.26302.115` (no stable GA yet).
- Migration source fixture: a real CLI (`ZeroDaySearch`, 7 commands) pinned to
  `System.CommandLine 2.0.0-beta4.22272.1`, the API removed before 2.0 GA.
- Behavior gates in the eval are deterministic and network-free (`--help` surfaces and
  parse errors), giving the judge objective ground truth a compile-only check cannot.

## Scenarios and results

| # | Scenario | Baseline → Grounded (quality) | Improvement | Interpretation |
| --- | --- | --- | --- | --- |
| S1 | Use a "new in 3.x" member (`AcceptOnlyFromAmong(StringComparer, …)`) | 5.0 → 5.0 | **−2.2%** | The member name is guessable; model-resident. **No signal.** |
| G1 | Greenfield: author a CLI on 3.x from scratch | 5.0 → 5.0 | **+1.1%** | 2.0-GA API == 3.x and is well-represented in training data. **No signal.** |
| M1a | Migrate a beta4 CLI to 3.x (compile + behavior gates) | 5.0 → 5.0 | **+6.4%** | The removed API is recoverable via compile errors + reflection. Grounding bought **efficiency only.** Below bar. |
| M1b | M1 + one **silent-break** trap (alias-vs-description ctor) | 5.0 → 5.0 | **+9.6%** (isolated **+20.6%**) | The content is clearly valuable (isolated arm), but a single trap is often self-recovered and the **plugin/delivery arm gated at +9.6%.** Just below bar. |
| M1c | M1b + **doc refocused** to dense, RAG-style migration/gotchas + sharper discovery description | 4.6 → 5.0 | **+15.1%** (isolated **+22.6%**, plugin **+15.1%**) | Scoping the doc and its discovery description **lifted the gating plugin arm from +9.6% → +15.1%.** **Clears the bar.** |

(M1 results are at `--runs 5` except where noted; full run artifacts in the appendix.)

## Analysis

### What models already know (skip it)

Three of four topic classes produced near-zero or negative signal. A strong model writes
correct current-API CLIs, guesses well-named new members, and — critically — **recovers a
removed-API migration through the normal development loop**: the compiler points at the
deleted member, and reflection over the installed assembly reveals the replacement. None of
that needs to be in a grounding doc; shipping it would only dilute context and retrieval.

### The durable gap: silent breaking changes

The one place grounding moved the **quality** dimension is a change the dev loop cannot
catch: a migration that **compiles cleanly but behaves wrong**. System.CommandLine's
canonical instance is the constructor signature shift introduced before GA:

```csharp
// 2.0.0-beta: 2nd positional argument is the DESCRIPTION
var verbose = new Option<bool>("--verbose", "verbose output");

// GA / 3.x: 2nd positional argument is an ALIAS
//   -> the beta line still COMPILES, but "verbose output" is now registered as a
//      (bogus) alias, the description is dropped, and --help is silently degraded.
// Correct:
var verbose = new Option<bool>("--verbose") { Description = "verbose output" };
```

Neither a compile error nor reflection reveals this — only prior knowledge of the shift
does. That is exactly the kind of fact worth grounding.

### Delivery matters as much as content

M1b vs M1c is the most actionable finding for *all* future grounding work. The grounding
content was identical in value (isolated arm ~+21–23% both times), yet the **gating
plugin arm moved from +9.6% to +15.1%** purely by:

1. Rewriting `AGENTS.md` as **dense, self-contained, keyword-dense sections** (no prose
   intro, no install boilerplate, headers named for the task query that should retrieve
   them), and
2. **Tightening the skill's discovery description** to advertise *migration & gotchas*
   rather than general usage.

In other words: a grounding doc that reads like a polished README *underperforms* one
written like a RAG result, because the agent retrieves and applies the latter more
reliably. Scope the doc to the tasks it actually helps; let the model handle the rest.

## Proposed grounding content

A ~44-line `AGENTS.md` (well under our 60-line budget) with four sections, in priority
order:

1. **Migrating 2.0.0-beta → GA/3.x** — a mapping table of removed members to their
   replacements (`AddOption`→`Options.Add`, `SetHandler`→`SetAction` + `parseResult.GetValue`,
   `getDefaultValue:`→`DefaultValueFactory`, `BinderBase`/`IConsole`/`HelpBuilder` removed,
   etc.). Names the old identifiers verbatim so a migration query matches.
2. **Gotchas (compile-clean but wrong)** — the alias-vs-description constructor shift, and
   the "options/args are referenced by identity" rule.
3. **Upgrading 2.x → 3.x (NOT beta)** — one line: it's a drop-in version bump; *do not*
   "modernize" working code. (A negative instruction that prevents wasted effort.)
4. **New API members in 3.x** — a terse reference list (additive over 2.x).

The current draft lives at
[`grounding/system-commandline/AGENTS.md`](../../grounding/system-commandline/AGENTS.md)
in this repo and is the artifact we would propose adding to the package
(`dotnet/command-line-api`).

## Threats to validity

- **Single model.** All runs used Opus 4.6 as both agent and judge. A weaker model would
  likely find more of this content non-resident (larger signal); a future model may find
  even the gotcha resident (smaller signal). The *shape* of the conclusion — "ground the
  silent breaks, skip the discoverable stuff" — should generalize, but exact magnitudes
  will move.
- **High run-to-run variance.** The passing M1c run had CV=91%, with one +21.8% run pulling
  up the mean. The signal is reproducibly **positive and above threshold**, but treat the
  *magnitude* as soft, not a precise number.
- **Threshold is a convention.** The 10% bar is the harness default, not a law of nature.
  The qualitative ranking of scenarios is the durable result.
- **One package, one ecosystem.** This is a System.CommandLine-specific finding. The
  methodology — not the specific verdict — is what we will reuse for the next package.

## Recommendation for the upstream PR

1. Add a short `AGENTS.md` to `System.CommandLine` containing the migration mapping and the
   silent-gotcha section above. Keep it dense and scoped; do not grow it into a usage guide.
2. Frame the package's skill/discovery description around **migration and gotchas** so it is
   retrieved for the tasks it helps and skipped for greenfield work.
3. Resist adding "how to build a CLI" content: we measured it as model-resident, and it
   dilutes retrieval of the content that matters.

## Appendix: reproduction

- Harness: `dotnet/skills` skill-validator @ `5d717dbdd1998cdf88e7542eef52c5517cbefdb9`,
  built from source by `eng/run-evals.sh`.
- Run: `eng/run-evals.sh System.CommandLine` (or
  `skill-validator evaluate --tests-dir ./tests --runs 5 grounding/system-commandline`).
- Eval spec + fixtures: `tests/system-commandline/`.
- Versions: target `System.CommandLine 3.0.0-preview.5.26302.115`; migration source
  `2.0.0-beta4.22272.1`; fixtures target `net10.0`.
- Result artifacts (`.skill-validator-results/`):
  - `20260619-115319` — M1b silent-break, `--runs 3` (+13.9%, noisy).
  - `20260619-125415` — M1b silent-break, `--runs 5` (+9.6%, gated by plugin arm).
  - `20260619-144946` — M1c refocused doc, `--runs 5` (+15.1%, clears bar).
- Authoring principles distilled from this work:
  [`docs/authoring-principles.md`](../authoring-principles.md).
