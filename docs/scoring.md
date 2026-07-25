# Scoring, grading, and the grounding PR

How an eval run becomes a **ship / no-ship decision** and a reviewable PR. The current grade model is
not a single verdict label: it is the two-axis **[quality-card model](./quality-card-model.md)**, with
explicit return and efficiency axes plus two ship gates.

> **Superseded framing.** Earlier versions of this doc used a single gate and verdict vocabulary,
> README comparison arms, and a push-delivered package file. That framing is retired. Read this doc as
> the current SKILL.md framing: a package carries a **base skill** named for the package plus **domain
> skills**, and a root meta-skill orchestrates install using Anthropic Agent Skills conventions
> (YAML frontmatter with `name` and a use-when `description`, then progressive disclosure into
> supporting files).

---

## The ship decision — two axes, two gates

Grounding is the technique and its measurement. The shipped artifact is a pull-installed,
opt-in, removable **SKILL.md skill set** in the consuming repo. The eval is therefore the same agent
with the skill set installed (**grounded**) versus not installed (**baseline**), not a README-vs-doc
comparison.

The full scoring model lives in the **[quality-card model](./quality-card-model.md)**. In short:

- **RETURN** — graded yield on the ladder `Fails < Satisfies < Delivers`, plus reliability `ΔP` on the
  shared-success set.
- **EFFICIENCY** — per-dollar IET over delivered runs is the economic cost stick; per-day duration is a
  co-headline, reported beside it but not used as the economic gate.

A skill set ships only when both gates clear:

1. **Do no harm:** loss mass must stay below the null-95 baseline.
2. **Economic materiality:** the per-dollar IET credible-interval upper bound must be `≤ ×0.80`, i.e.
   at least a certified 20% cost cut.

Older fixed 25% win caps are superseded by the quality card's ≥20% economic gate.

## Headline quality card

Suite: **CT-24**. Repeats: `k = 5`. Models: `claude-haiku-4.5`, `claude-sonnet-5`,
`claude-opus-4.8`. Comparison: grounded SKILL.md skill set versus baseline.

| Model | Mean yield | Reliability ΔP | Per-$ IET geomean | Per-day duration geomean | Econ gate upper | Do-no-harm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Haiku | 0.533 → 0.942 | +0.263 | ×0.20 [0.18, 0.33] | ×0.28 | ×0.33 | loss mass 0.000 vs null 3.2 |
| Sonnet | 0.775 → 1.000 | +0.191 | ×0.26 [0.23, 0.35] | ×0.21 | ×0.35 | loss mass 0.000 vs null 2.2 |
| Opus | 0.883 → 1.000 | +0.117 ⚠ | ×0.40 [0.35, 0.52] | ×0.38 | ×0.52 | loss mass 0.000 vs null 1.2 |

All three models clear the `×0.80` economic-materiality bar and the do-no-harm gate. The Opus
reliability lift is prior-sensitive, so treat it as supportive rather than the primary headline.

## Running and reading an eval

The current run shape for the ratified comparison is:

```bash
grounding run <slug> --source skill --eval-mode holistic --runs 5
```

The analyzer still contains legacy card views, but the authoritative interpretation is the quality-card
model above: report return, per-dollar IET, per-day duration, the economic upper bound, and loss mass.
Where historical datasets measured a package-shipped doc, call it **the grounding doc** and treat it as
a delivery-channel experiment, not the live delivery model.

## Copy-paste PR card

Paste a compact quality-card summary into the PR's *Metrics* section:

```text
### Grounding eval — <unit> · CT-24 · k=5

| Model | Mean yield | Reliability ΔP | Per-$ IET geomean | Per-day duration | Gates |
| --- | ---: | ---: | ---: | ---: | --- |
| claude-haiku-4.5 | 0.533 → 0.942 | +0.263 | ×0.20 [0.18, 0.33] | ×0.28 | harm clear; econ upper ×0.33 |
| claude-sonnet-5 | 0.775 → 1.000 | +0.191 | ×0.26 [0.23, 0.35] | ×0.21 | harm clear; econ upper ×0.35 |
| claude-opus-4.8 | 0.883 → 1.000 | +0.117 ⚠ | ×0.40 [0.35, 0.52] | ×0.38 | harm clear; econ upper ×0.52 |
```

If a package-specific report also includes historical channel data, preserve its numbers but label the
doc arm as **grounding doc** and link the frozen report rather than rewriting it.

### Historical per-package card example

NuGetFetch's earlier mini-tier primary card remains useful as a per-package metric dump. The framing is
historical, but the quantities are preserved here with current naming:

| Metric (goal) | Baseline | Grounding doc |
| --- | ---: | ---: |
| tasks correct (+) | 5/6 | 6/6 |
| func passed (assertions) (+) | 17/18 | 18/18 |
| nuget-cache reads (archaeology) (-) | 31 | 0 |
| tool calls: web / bash / other (context) | 4/58/70 | 0/22/64 |
| grounding load (tok) (context) | 0 | 540 |
| read grounding (%) | 0% | 100% |
| output tok (% of IET) (-) | 5782 (28%) | 1716 (26%) |
| tool-call turns (% of total) (-) | 18 (95%) | 8 (89%) |
| tool-turn secs (% of turn time) (-) | 120s (96%) | 44s (91%) |
| tool-turn IET (% of turn IET) (-) | 96% | 92% |
| Session turns (-) | 19 | 9 |
| Session IET (-) | 31816 | 17558 |
| Session Cost (-) | 7.75 | 2.28 |

Quality-card readout: tasks correct improved 5/6 → 6/6, nuget-cache reads fell 31 → 0, web calls
fell 4 → 0, session IET fell 45%, and cost fell 71%.

## What a grounding PR contains

| Artifact | Path |
| --- | --- |
| Base package skill | `grounding/<unit>/SKILL.md` |
| Domain skills and supporting files | `grounding/<unit>/**` |
| Matched grounded-vs-baseline dataset | `data/<unit>*/` |
| Package report | `docs/reports/<unit>.md` |

### PR description format

Use `.github/PULL_REQUEST_TEMPLATE.md`. Required sections: **Changes** (what changed and why the
quality card motivated it), **Metrics** (paste the card summary), **Analysis** (what grounding changes
in the transcripts), **Validation** (exact commands), and **Caveats** (sample size, cache state, and any
mid-transition repository constraints).

### Validation (reproducible)

```bash
grounding run <slug> --source skill --eval-mode holistic --runs 5
```

## Reviewer checklist

- [ ] The artifact is a pull-installed SKILL.md skill set: base skill plus domain skills.
- [ ] Grounded and baseline runs use the same agent, same CT-24 suite, and `k = 5` repeats.
- [ ] Models are named: Haiku, Sonnet, and Opus.
- [ ] RETURN is reported as graded yield plus reliability ΔP.
- [ ] EFFICIENCY reports per-dollar IET and per-day duration.
- [ ] Do-no-harm gate clears: loss mass is below the null-95 baseline.
- [ ] Economic-materiality gate clears: per-dollar credible-interval upper bound is `≤ ×0.80`.
- [ ] Claims cite normative quality-card metrics; transcript/tool signals only explain the mechanism.
- [ ] Frozen per-package reports are linked, not edited, when they contain historical channel data.

## Why subjective quality is a floor, not a ship score

Earlier cards tried to gate on a judge quality diff (`overallScore_grounded − overallScore_baseline`).
We retired that. A correct solution (build + run + assertions pass) lands at **4–5 by construction**, so
the judge's 1–5 score has only **~1 point of usable range** for correct work. That top band is
subjective and instruction-sensitive, not a stable basis for a harm verdict.

**Evidence.** We re-judged the *identical* set of Opus 4.8 NuGetFetch sessions under four judge
framings. The mean quality Δ (grounded − baseline) swung across a ~0.45 range on judge wording alone:

| Judge framing | mean quality Δ |
| --- | ---: |
| original (inline) | −0.15 → negative legacy label |
| re-judge, same prompt | −0.017 (tie) |
| + efficiency clause | +0.28 |
| + path-neutrality clause | +0.10 |

A metric that swings from a negative label to a clear win on wording alone cannot gate shipping.

**The bias.** The judge rewarded visible effort: an ungrounded agent that reverse-engineers the API via
reflection reads as "rigorous," while an agent that trusts the package's own grounding was docked for
"relying on an unverified external skill" — even when both arms satisfied the outcome criteria. That is
backwards for grounding, whose value is making that effort unnecessary.

**The fix:**

1. **Decompose quality into graded yield plus resourcefulness signals.** Yield is the normative floor;
   archaeology, web use, tool turns, and IET explain how much effort the agent spent.
2. **Debias the judge's floor.** Package grounding surfaced through SKILL.md or a trusted tool is a
   first-class source, equal to reflection or reading source. Judge the result given the constraints,
   not the difficulty of the path.

See [`authoring-principles.md`](./authoring-principles.md) for how this connects to generating
grounding from a zero-grounding baseline rather than from a model-written draft.
