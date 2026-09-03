# OpenAI model transition

**Decision date:** 2026-09-03  
**Status:** adopted for new evaluation work

The grounding program is moving its active evaluation cohort from Anthropic models to OpenAI
models. This is a model-family and measurement-epoch change, not a methodology change.

The transition starts after:

- [#77](https://github.com/richlander/dotnet-package-skills/pull/77), the final current-shelf
  recertification published with the Anthropic cohort; and
- [#80](https://github.com/richlander/dotnet-package-skills/pull/80), which established upstream
  Vally as the execution and data plane while keeping `grounding` authoritative for classification
  and quality cards.

## Model cohort

The new cohort preserves the three operational roles used by the Anthropic measurements:

| Role | Retired active model | New active model |
| --- | --- | --- |
| Mini / economical | `claude-haiku-4.5` | `gpt-5.6-luna` |
| Balanced | `claude-sonnet-5` | `gpt-5.6-terra` |
| Frontier | `claude-opus-4.8` | `gpt-5.6-sol` |

These are role replacements, not claims that the paired models have identical capabilities,
latency, tokenization, or economics. Each OpenAI model is its own cohort. Results are reported per
model and are never pooled across model classes.

The judge is an independent pin, not a fourth evaluation cohort. Where an execution tool requires
one, its GPT-5.6 model and reasoning effort must be selected during the compatibility smoke and
pinned before any scored run. Judge output does not participate in
`Fails < Satisfies < Delivers`; only named deterministic functional graders classify outcomes.

## What does not change

The transition must preserve the grounding regime rather than adapt it to a model provider or to
Vally's default reports:

- The unit of analysis is the task, not the pooled batch.
- Each task has paired baseline and grounded arms with fixed `k`.
- The outcome ladder is reconstructed from named deterministic graders:
  - any failed `satisfies/*` grader is `Fails`;
  - all `satisfies/*` graders passing with any failed `delivers/*` grader is `Satisfies`;
  - all `satisfies/*` and `delivers/*` graders passing is `Delivers`.
- Reports retain task-level coverage, reliability, fidelity, do-no-harm, and efficiency.
- Per-skill cards are observational results from natural full-shelf activation. A skill is not
  forced onto every task.
- Positive, negative, and opposing controls must retain their expected classifications.
- Model, reasoning effort, judge, package, fixtures, shelf, applicability contract, eval, grader
  manifest, and Vally version are pinned before a certification run.
- Infrastructure or provenance failures invalidate a dataset; they cannot classify as `Fails`.

## A new measurement epoch

Anthropic and OpenAI results are not numerically interchangeable. Historical Anthropic datasets and
reports remain valid evidence for the shelves and models they measured, but they are frozen records.
They must not be spliced, pooled, normalized, or trended with OpenAI trials.

The first accepted OpenAI run establishes a new epoch with new baselines. Comparisons inside that
epoch must hold the following fixed between baseline and grounded arms:

- exact model ID and reasoning effort;
- Vally and Copilot execution versions;
- package closure and SDK;
- fixtures, assertions, task set, and `k`;
- environment isolation and available tools; and
- shelf and applicability hashes.

The OpenAI IET scheme is initially:

```text
(input - cacheRead) + 0.10 * cacheRead + 6 * output
```

Before the first certification run, a compatibility smoke must confirm that all three models emit
the expected input, cached-input, output, duration, activation, and trial-identity fields. The
formula and any no-cache treatment must be checked against the current model economics. If they
change, the scheme is versioned and pinned before looking at quality-card results.

## Transition sequence

1. Replace active defaults and run scripts with the three-model OpenAI cohort. Historical data,
   frozen reports, and filenames are not rewritten.
2. Generalize Vally manifests and provenance validation so every result is bound to exactly one
   expected model. Generate separate task and skill cards per model.
3. Pin reasoning effort for each model after a representative compatibility smoke; do not rely on
   provider defaults or `auto`.
4. Run positive, negative, and opposing controls for each model.
5. Run representative shelf smokes, then the complete shelf experiment.
6. Publish the all-task card and the natural-activation six-row card for each skill.

## System.CommandLine upstream gate

System.CommandLine is the first shelf to take through the OpenAI epoch and prepare for an upstream
pull request to
[`dotnet/command-line-api`](https://github.com/dotnet/command-line-api).

The candidate shelf currently has one base skill and five workflow skills:

- `system-commandline`
- `system-commandline-beta-to-ga-migration`
- `system-commandline-options-and-arguments`
- `system-commandline-actions-and-invocation`
- `system-commandline-subcommands-and-help`
- `system-commandline-net-3x-additions`

Upstream readiness requires:

- a package version, fixture set, shelf, and applicability contract pinned before execution;
- the shipping skill names and layout used in the evaluation, with no harness-only base identity;
- a full-shelf run for each OpenAI model before interpreting individual skill behavior;
- correct positive, negative, and opposing controls;
- an all-task quality card and one six-row natural-activation card per skill:
  retrieval, coverage, reliability, fidelity, do no harm, and efficiency;
- an explicit ship, revise, merge, or omit decision for every skill;
- fixes driven by demonstrated retrieval, efficacy, fidelity, harm, or efficiency gaps rather than
  by speculative content expansion; and
- an upstream-focused change containing the skills and the evidence needed by maintainers, without
  requiring the evaluation infrastructure to ship in the package repository.

The upstream decision is per skill. A strong shelf-level result does not require every skill to
ship, and a weak or unused skill is not retained to fill out the shelf.

## Completion criteria

The transition is complete when:

- active commands, examples, pins, and manifests use the OpenAI cohort;
- model-specific controls and telemetry validation pass;
- one complete OpenAI shelf run produces accepted task and per-skill cards without cross-model
  pooling;
- the current evidence index distinguishes the frozen Anthropic epoch from the OpenAI epoch; and
- the System.CommandLine shelf has per-skill dispositions and an upstream-ready pull request.
