# Package grounding — the concept in one pass

> **New here?** *Grounding* is small, targeted, package-authored instruction that helps an AI coding
> agent use a library correctly — shipped as a **`SKILL.md`** skill set the agent opts into. We
> **measure** whether it helps by running each task **with and without** the grounding and comparing
> the results with the ratified **[quality-card model](./quality-card-model.md)**: two axes
> (**return** = does it succeed, reliably; **efficiency** = per-dollar cost and per-day speed) and two
> ship gates (**do no harm** + a certified **≥20% economic** win).

Package grounding is package-authored context that teaches a model how to use a specific library
correctly. The delivered artifact is a **`SKILL.md`** skill set — authored to the
[Agent Skills](https://www.anthropic.com/news/skills) convention (YAML frontmatter with a `name` and
a "use when…" `description`, progressive disclosure into supporting files) — that an agent **pulls on
demand** and a consuming repo can remove. A package carries a small **base skill** (named for the
package) plus a handful of **domain skills** for its long-tail workflows.

The core question is not *"can we write grounding?"* but *"does this grounding actually help, and is it
worth its keep?"* This document explains how we answer that.

## Why grounding is needed

When an agent touches a package, the best it usually gets is the package README, and often not even
that. Across the **top 1,000** Microsoft/Azure/System packages, **62% ship no in-package README at
all**, and roughly 50% of the top 1,000 community packages don't either. Where one does exist it is
small, a median of **~2–3 kB**, with a long tail out to **44–94 kB**
([top-1,000 survey](reports/readme-size-survey-top1000.md); earlier
[top-40 study](reports/readme-size-survey.md)).

Size is only half the problem. READMEs are written to **onboard a human browsing nuget.org**:
install steps, prerequisites, "key concepts," contributing boilerplate (2–4 kB on its own in the
Azure-SDK template), and broad usage examples, *most of which the model already knows*. Installation
is the clearest waste. By the time an agent is working in a project that *references* the package,
installation is solved by definition, because the dependency is already there. Little of a README is
the non-obvious, version-specific gotcha an agent actually needs.

A skill inverts that ratio: a small, targeted doc carrying **only what the model is proven to lack**,
the non-obvious, version-specific gotchas ("footguns") that otherwise send the agent digging through
decompiled assemblies or the web. Grounding earns its place by deleting that archaeology.

## What "knowledge" means here

Grounding only helps where the model's own knowledge falls short, so the value depends on how *trained*
the model is on a given package.

- **Models** are trained on popular packages and progressively less so on niche ones — a decay curve
  that roughly tracks blog-post and Stack-Overflow volume. A **frontier** model's curve decays later
  than a **mini** model's, so the most popular packages are resident for both, but niche packages fall
  out of the mini model first.
- This is why grounding tends to help the **mini** tier most (it fills a real gap) while a **frontier**
  model may already know the answer. The measurement has to respect that asymmetry — a grounding change
  can be a real win for one model and redundant for another.

Knowledge here means *resident* model knowledge — not what the model could recover with web search or
tools. Recovering a fact by digging is exactly the cost grounding removes.

## What we measure: grounded vs baseline

Evaluation is a **paired, two-arm** comparison on one fixed harness:

- **baseline** — the agent attempts the task with **no** grounding loaded.
- **grounded** — the same agent attempts the same task with the **`SKILL.md`** grounding available to
  pull.

Each `(task, arm)` is run **k = 5** times (grounding effects are noisy on any single run), across three
models — `claude-haiku-4.5`, `claude-sonnet-4.5`, and `claude-opus-4.8` — so we can see the
mini-vs-frontier asymmetry directly. The live suite is **CT-24**: 24 graded tasks that grow from day-1
common usage to niche day-100 workflows.

We record, per run: whether the task was **delivered** (all functional assertions pass *and* it was
done as asked), the **token cost** ([IET](./iet-model.md)), the **wall-clock duration**, and the
**archaeology** the agent resorted to (cache decompiles, nuget.org fetches, web searches). Grounding
should drive correctness up and archaeology, cost, and time down.

## How we grade: the quality card

A run becomes a **ship / no-ship decision** through the ratified
**[quality-card model](./quality-card-model.md)**. The short version:

- **Two axes.**
  - **Return** — does the grounding produce good work, dependably? Measured as **graded yield** over
    all five runs on the `Fails < Satisfies < Delivers` ladder (a `2/5` is low yield, not "failure"),
    plus **reliability** (the paired lift on tasks both arms can do).
  - **Efficiency** (over delivered runs only) — **per-dollar cost** (IET, the gated headline) and
    **per-day duration** (wall-clock, a co-headline reported beside cost, never a gate).
- **Two ship gates.** A change ships only if it clears **both**:
  - **Do no harm** — no material regression on work the baseline already delivered (measured against a
    noise-calibrated threshold, so ordinary run-to-run luck can't trip it).
  - **Economic materiality** — a **certified ≥20%** per-dollar cost cut (the minimum premium that
    repays authoring the grounding and keeping it current as models drift).

The card reports a **graded** two-axis win, not a single `pass/fail` label. See
[quality-card-model.md](./quality-card-model.md) for the full model — including the plain-English
analogies (semiconductor wafer yield / cost-per-good-die, and a basketball "do no harm" substitute) —
and [quality-card-spec.md](./quality-card-spec.md) for the row-level reference.

## How we measure cost: IET

The cost stick is **IET — Input-Equivalent Tokens** — a single cost-equivalent number that normalizes
each billed token class to fresh-input units, so a cheap-cache-read-heavy run and an
output-heavy run are compared on one honest scale. The full model, including how analyzer token fields
map to IET, is in [iet-model.md](./iet-model.md).

## Where to go next

- **[getting-started.md](./getting-started.md)** — build the CLI, author a skill, run the ladder, read
  the card.
- **[grounding-eval-methodology.md](./grounding-eval-methodology.md)** — the full measurement approach.
- **[quality-card-model.md](./quality-card-model.md)** — how a run becomes a graded, gated decision.
- **[scoring.md](./scoring.md)** — turning a graded run into a reviewable grounding PR.
