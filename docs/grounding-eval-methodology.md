# Grounding eval methodology

> **New here?** Grounding is both the technique and its measurement. We compare the same agent with a
> package `SKILL.md` skill set installed against the same agent without it. For grading and shipping,
> use the ratified [quality-card model](./quality-card-model.md).

This document defines the evaluation approach for package grounding. It covers the evaluation contrast,
the CT-24 suite, run discipline, confounds, and the evidence a PR must carry. The shipped artifact under
this model is a pull-installed skill set: a base skill named for the package plus domain skills,
installed into the consuming repo.

Core rule: **a grounding change is a claim, and the claim ships with evidence.** A skill-set edit without
a reproducible grounded-vs-baseline eval is not reviewable.

## 1. Evaluation contrast

There are exactly two arms:

| Arm | Setup | Question |
| --- | --- | --- |
| **baseline** | Same agent, no package skill set installed | What does the model already know or recover on its own? |
| **grounded** | Same agent, package `SKILL.md` skill set installed | What changes when the package teaches the missing facts? |

No README comparison arm is part of this methodology. Historical data that measured a doc shipped inside
the package should be read as measurements of *the grounding doc* from the old delivery experiment, not
as current delivery guidance.

The contrast is pull delivery: the skill set is opt-in, installed into the consuming repo, and removable.
Push-style always-on package delivery is not a current ship target.

## 2. Suite and repetition

The benchmark suite is **CT-24**, an opaque 24-task workflow ladder. Keep the label opaque in infra docs;
it names the suite, not a document tier.

Run discipline:

- `k = 5` repeats for every `(task, arm, model)` cell.
- Models: `claude-haiku-4.5`, `claude-sonnet-5`, and `claude-opus-4.8`.
- Hold prompts, assertions, package version, judge configuration, and tool policy fixed across arms.
- Treat a result as model-relative; do not generalize a frontier-model null result to cheaper agents.

The real command shape is:

```bash
grounding run <slug> --source skill --eval-mode holistic --runs 5
```

Add `--model` values as needed for the three model tiers. The command name and flags above match the
current CLI; do not rename mid-transition commands in docs.

## 3. What the harness records

The harness should preserve enough per-run evidence to build the quality card:

- outcome on the `Fails < Satisfies < Delivers` ladder;
- functional assertions and, where applicable, approach assertions;
- input, cache-read, cache-write, and output tokens;
- IET and dollar cost;
- duration and turn count;
- tool calls, web access, and local package archaeology;
- provenance: package version, skill content hash, prompts, assertions, model, judge, and run count.

Mechanics live in [harness.md](./harness.md). The grading model lives in
[quality-card-model.md](./quality-card-model.md).

## 4. Grading and shipping

The quality card has two axes.

### RETURN

RETURN measures whether grounding produces more usable work:

- graded yield on the ladder `Fails < Satisfies < Delivers`;
- capability wins where only the grounded arm delivers;
- reliability `ΔP` on the shared-success set;
- loss mass for tasks the baseline delivered but grounding damaged.

### EFFICIENCY

EFFICIENCY measures what a delivered unit costs:

- per-dollar IET over delivered runs as the gated headline;
- duration per day as a co-headline, reported but not gated;
- variance and resourcefulness as explanatory signals.

### Ship gates

A skill-set change ships only when both gates pass:

1. **Do no harm** — loss mass must clear the null-95 baseline.
2. **Economic materiality** — the per-dollar credible-interval upper bound must be `≤ ×0.80`, meaning a
   credible cost cut of at least 20%.

Do not replace these with a single aggregate score. Report the card rows that support the claim.

## 5. Metric vocabulary

| Term | Meaning |
| --- | --- |
| **Grounding** | The technique and measurement of installing package-specific skill docs so agents can use package facts they otherwise lack. |
| **Skill set** | The shipped artifact: package base skill plus domain skills, all using `SKILL.md` frontmatter and progressive disclosure. |
| **Baseline** | The same agent without the package skill set installed. |
| **Grounded** | The same agent with the package skill set installed. |
| **Resourcefulness** | Web, local package-cache rummaging, decompilation, or other archaeology used to rediscover facts grounding should supply. Lower is better. |
| **IET** | Input-Equivalent Tokens: `(input − cacheRead) + 0.1·cacheRead + 1.25·cacheWrite + 5·output`. It maps to Anthropic's billed categories and weights output at 5×. |
| **Cost** | IET multiplied by the model's input price; the primary spend proxy. |
| **Duration** | Wall-clock time. It is a co-headline because developer latency matters, but it is not a ship gate. |
| **Normative metrics** | RETURN and EFFICIENCY rows that can carry a claim: graded yield, reliability, loss mass, IET, cost, and duration. |
| **Informative signals** | Tool mix, turns, cache reads, web use, and archaeology. They explain behavior but do not decide shipping alone. |

## 6. Confounds and how to read them

### Baseline self-grounding through restored packages

Older experiments packed a grounding doc in the package. A build could restore that package into the
local NuGet cache, letting the baseline discover the doc through archaeology. That makes the baseline
partly self-grounded and understates the value of explicit grounding. Treat those historical deltas as
lower bounds.

### Tool availability

To keep the contrast about grounding content rather than tooling, evals should hold tool availability
constant across arms. When a tool is the intervention, make it a separate experiment.

### Warm cache

Build-based scenarios usually restore the package during the first few tool calls, so starting cache state
is not an independent variable. Record it, but do not treat it as a separate arm unless the task is
explicitly about restore behavior.

### Judge and assertion discipline

The card should grade only requirements that are visible in the prompt and reducible to assertions. Use
human review and one-time judge audits to validate prompt/assertion coverage. Do not use subjective style
or elegance as a ship gate.

### Model relativity

Grounding value depends on the agent. The same package fact can be redundant for a frontier model and a
large win for a cheaper model. Always report results per model and avoid fleet-wide claims unless all
three model tiers support them.

## 7. Evidence package for PRs

A grounding PR should include:

- the grounded-vs-baseline claim;
- the command, run count, models, package version, and dataset locations;
- the quality card: RETURN, EFFICIENCY, and the two ship gates;
- representative failures or successes that explain the movement;
- any confounds, especially archaeology or tool-policy differences;
- validation that the current command names and flags are real.

Use [templates/canonical-grounding-pr.md](./templates/canonical-grounding-pr.md) as the fill-in shape.
