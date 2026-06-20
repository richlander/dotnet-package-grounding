# Does Microsoft.Extensions.AI need agent grounding? A measured answer

**Package:** `Microsoft.Extensions.AI`
**Date:** 2026-06-19
**Status:** Findings complete. Recorded as a third cross-package validation of the methodology
developed for the System.CommandLine and System.Text.Json units.

## TL;DR

Microsoft.Extensions.AI (M.E.AI) **does not need general agent grounding** on the evidence we
gathered. We probed the package's single most prominent silent footgun — tools registered in
`ChatOptions.Tools` never run unless the client pipeline includes `.UseFunctionInvocation()` —
and it **did not clear the 10% improvement bar** against a strong frontier model. It came back
**−1.0%**, with unusually low variance.

- **Function-invocation wiring** (a tool placed in `ChatOptions.Tools` is silently inert
  unless a `FunctionInvokingChatClient` is in the pipeline; the call succeeds, `response.Text`
  is empty, the function never runs, nothing throws): **−1.0%** (runs=5, CI [−1.6%, −1.0%],
  significant). The baseline agent diagnoses the missing `UseFunctionInvocation` and fixes it
  in a single edit **every run**. *Silent but famous → model-resident.*

**Recommendation:** do **not** ship a general M.E.AI `AGENTS.md` on the strength of the
canonical function-calling gotcha. It is the package's most-demonstrated pattern (every
tutorial wires `UseFunctionInvocation`), so a strong model already writes it unprompted. If
M.E.AI grounding is ever shipped, it should target a **genuinely obscure** silent behavior
(candidates below), not the headline footgun.

## Why measure instead of assert

M.E.AI looked like a *promising* grounding target going in: it is a **new** package (preview
through 2024–2025, GA `9.5.0` ~May 2025), it churned its core API hard during preview with
**no `[Obsolete]` shims**, and its builder/middleware pipeline is unusual. The hypothesis was
that much of it would be post-training or under-represented and therefore non-resident. The
discipline of the methodology is to *test* that hypothesis rather than assume it: ship grounding
only for content that **measurably changes agent behavior** on a representative task by a
meaningful margin. M.E.AI is a useful counter-case because the intuition ("new package → needs
grounding") turned out to be wrong for its most prominent gotcha.

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
- Target: **Microsoft.Extensions.AI 9.7.0** on `net10.0`.
- **Fully offline and deterministic.** The fixture supplies a stub `IChatClient`
  (`StubChatClient`) that simulates a model's tool-calling protocol with no network: on the
  first call it returns a `FunctionCallContent` asking for `GetWeather`; once it sees a
  `FunctionResultContent` in the history it returns the final answer echoing that result. This
  lets the behavior gate (`Sunny, 72F` must appear in stdout) give the judge objective ground
  truth: a correctly wired pipeline invokes the tool and prints the weather; the unwired
  version prints an empty `Assistant:` line and fails the gate.

The prompt includes the **"build and run to confirm"** instruction so both arms verify their
own work, leveling the verification-visibility confound observed in the System.Text.Json unit.

## Scenario and result

| # | Scenario | Baseline → Grounded (quality) | Improvement | Interpretation |
| --- | --- | --- | --- | --- |
| A1 | Fix a weather assistant that prints an empty answer because its `IChatClient` is used directly, without `.UseFunctionInvocation()` in the pipeline (silent break = tools in `ChatOptions.Tools` are never invoked; `response.Text` is empty, no exception) | 5.0 → 5.0 (quality tied) | **−1.0%** (runs=5; iso −0.6%, plugin −1.0%; CI [−1.6%, −1.0%], significant) | The baseline agent reliably identifies the missing `UseFunctionInvocation` and adds it (or a `FunctionInvokingChatClient`) in one edit. Judge winner: **tie**. The package's headline gotcha is **model-resident**. No signal. |

(Effective score `min(isolated=−0.6%, plugin=−1.0%) = −1.0%`. The grounded arms spent **more**
tokens — isolated +29%, plugin +35% — reading grounding that restated knowledge the model
already had, while using slightly fewer tool calls (5 vs 7). Full artifacts in the appendix.)

## Analysis

### What the model already knows (skip it)

Automatic tool invocation requiring `UseFunctionInvocation()` *feels* like a trap — it is a
genuinely **silent** break (compiles, runs, returns success, but the tool never fires and the
text is empty), and Microsoft's docs do not flag it as a "pitfall." Yet it produced **negative**
signal. The reason is the same one that sank System.Text.Json's case-insensitivity scenario:
the pattern is **everywhere**. Every M.E.AI function-calling sample, blog post, and quickstart
builds the client with `.UseFunctionInvocation()`. The model has seen the correct shape
thousands of times, so when it reads code that puts tools in `ChatOptions.Tools` and calls a
raw client, it immediately recognizes the omission and fixes it — every run, with low variance.

> *Silent is necessary but not sufficient; the gap must also be **obscure** (rarely
> demonstrated). A heavily-exampled pattern is model-resident even when it is undocumented as
> a pitfall.*

### Low variance makes the resident verdict robust

Unlike most scenarios in this repo (where run-to-run variance is endemic and large), A1 was
**tight**: CI [−1.6%, −1.0%], reported "significant," quality tied at 5.0/5 on both rubric and
overall axes, judge winner "tie" on the narrative. There is little ambiguity here — this is a
clean "the model already knows this" result, not a noisy null.

### Where signal might still hide (not yet tested)

A1 is the *canonical* M.E.AI footgun, and it is resident. That does not rule out grounding value
in M.E.AI's genuinely **obscure** corners — behaviors that are both silent and rarely
demonstrated, and therefore plausibly non-resident:

- **`ChatOptions.Tools` is `[JsonIgnore]`.** When a `DistributedCachingChatClient` serializes a
  request for its cache key, tools are dropped — two requests that differ only in their tools
  can collide on one cache entry, silently returning the wrong cached response.
- **`response.Text` concatenates *all* assistant messages.** After multi-turn tool calls
  `response.Messages` holds several entries, so `Text` may include intermediate content — but
  this surfaces as *visibly* wrong output, so an agent that runs the app would likely
  self-correct (failing the "silent" test, like the STJ × AOT case).
- **Middleware ordering / shared `ChatOptions` mutation** across concurrent calls.

These are left as future probes. Based on the methodology's track record, only the *first*
(silent **and** obscure **and** not self-correcting) is a strong candidate to clear the bar; we
did not invest in it because the package's headline behavior is already shown to be resident and
the marginal value of one more probe is low.

## Conclusion

**Verdict: Microsoft.Extensions.AI does not need general agent grounding for its most prominent
gotcha (trends toward claim #3).** The function-invocation footgun — the one behavior any
M.E.AI grounding doc would lead with — is model-resident at **−1.0%** with low variance.

This is the **third** package whose headline silent gotcha turned out to be resident
(System.Text.Json case-insensitivity; Microsoft.Extensions.AI function invocation), and it
sharpens the central rule that emerged from the System.CommandLine win:

> Ground a gotcha only if it is **silent** (compiles *and* runs without error but behaves
> wrong), **obscure** (rarely written about / demonstrated → genuinely non-resident), **and**
> not self-correcting at run time. M.E.AI's most famous gotcha fails the second test — it is
> silent but ubiquitously exampled, so the model has it cold.

The "new package" intuition is not a reliable proxy for "needs grounding." What matters is
whether a *specific behavior* is silent **and** obscure **and** unrecoverable — a far narrower
target than a package's overall novelty.

## Threats to validity

- **Single scenario.** We tested one (canonical) behavior. The verdict is "the headline gotcha
  is resident," not an exhaustive package audit; the obscure candidates above are untested.
- **Single model.** All runs used Opus 4.6 as both agent and judge. A weaker model would likely
  find more M.E.AI content non-resident. The *shape* of the conclusion should generalize; exact
  magnitudes will move.
- **Threshold is a convention.** The 10% bar is the harness default. The qualitative ranking —
  resident vs. loud vs. silent-and-obscure — is the durable result.
- **Offline stub, not a live model.** The fixture uses a deterministic `StubChatClient` to
  simulate the tool-call protocol. This isolates the *wiring* behavior under test (whether the
  pipeline invokes tools) from model nondeterminism; it does not exercise a real provider, which
  is intentional — the gotcha is in client composition, not the model.

## Appendix: reproduction

- Harness: `dotnet/skills` skill-validator @ `5d717dbdd1998cdf88e7542eef52c5517cbefdb9`,
  built from source by `eng/run-evals.sh`.
- Run: `eng/run-evals.sh Microsoft.Extensions.AI` (or
  `skill-validator evaluate --tests-dir ./tests --runs 5 grounding/microsoft-extensions-ai`).
- Eval spec + fixtures: `tests/microsoft-extensions-ai/`.
- Versions: Microsoft.Extensions.AI `9.7.0` on `net10.0`.
- Result artifacts (`.skill-validator-results/`):
  - `20260619-185226` — A1 function invocation, `--runs 5` (−1.0%, CI [−1.6%, −1.0%]).
- Authoring principles distilled from this work:
  [`docs/authoring-principles.md`](../authoring-principles.md).
