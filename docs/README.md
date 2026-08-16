# Docs

Generic infrastructure for evaluating NuGet package **grounding**. Start at the top, then go deep.

## Primary

- **[overview.md](./overview.md)** — **read this first**: the concept and the method end to end —
  grounding as a pull-installed `SKILL.md` skill set, what a skill buys, measured **grounded vs
  baseline** on the CT-24 workflow ladder across three model tiers, and graded with the quality
  card.
- **[quality-card-model.md](./quality-card-model.md)** — **the measurement model** (start here for
  *how we judge*): the two axes (**RETURN** = graded yield + reliability, **EFFICIENCY** = per-dollar
  cost *and* per-day duration), the `Fails < Satisfies < Delivers` ladder, and the **two ship gates**
  (do-no-harm + economic-materiality ≥20%). Plain-English analogies throughout (semiconductor yield,
  basketball "do no harm").
- **[quality-card-spec.md](./quality-card-spec.md)** — the **row-level reference** for the card
  (`analyze --view card`): every row as Label · Equation · Example · Description. Derives from the
  model doc.
- **[getting-started.md](./getting-started.md)** — the map of the whole workflow: every stage in
  order, who drives it, and the doc that owns it.
- **[running-eval.md](./running-eval.md)** — point the harness at a package repo's grounding and read
  the result. Grounding lives in the target repo; the harness reads it in place (no packing).
- **[grounding-eval-methodology.md](./grounding-eval-methodology.md)** — the *approach*: the
  **grounded-vs-baseline** contrast (same agent, `SKILL.md` skill set on vs off), the CT-24 workflow
  ladder, k=5 repeats across model tiers, and the confounds.
- **[delivery-methodology.md](./delivery-methodology.md)** — the *delivery axis*: grounding ships as
  a **pull-installed** `SKILL.md` skill set (model-invoked, opt-in, removable). The
  shared-pinned-baseline procedure and the anti-overclaim guardrails.
- **[skill-shelf-methodology.md](./skill-shelf-methodology.md)** — the *holistic benchmark* and
  *composition-axis LIET*: how we evaluate a whole **shelf** of skills (agent self-selects) and
  attribute the shelf's score back to individual skills — the two paradigms (per-skill PR vs
  holistic), the ascend-to-oracle polarity, the three interference regimes, and the attribution
  protocol. The skill-shelf counterpart to `grounding-eval-methodology.md`.
- **[scoring.md](./scoring.md)** — *grading and shipping*: the graded two-axis verdict, the two ship
  gates (do-no-harm + economic-materiality), the cards, and the PR contents + checklist. See
  `quality-card-model.md` for the full model.
- **[eval-protocol.md](./eval-protocol.md)** — *measurement discipline*: the pre-registered rules that
  keep numbers honest — arm hygiene, variance-aware n, pass-rate metric, robust assertions, no
  splicing — each tied to a real mistake it prevents.

## Supporting references

- **[authoring-principles.md](./authoring-principles.md)** — how to author a package's `SKILL.md`
  skill set: what to include (the proven-lacking footguns), what to leave out, and the line budget.
- **[delivery-and-retrieval.md](./delivery-and-retrieval.md)** — how grounding reaches the agent: the
  resident index, MCP delivery, and retrieval gates.
- **[iet-model.md](./iet-model.md)** — how the analyzer maps Copilot token fields to IET, including
  prompt-cache evidence, provider models, and tool-turn IET.
- **[harness.md](./harness.md)** — how `skill-validator` is built and run, and the confounds.
- **[grounding-lifecycle.md](./grounding-lifecycle.md)** — the skill lifecycle playbook: create /
  update / delete / evaluate, and what evidence each operation owes.

## Study artifacts

- **[recommendation.md](./recommendation.md)** — the NuGet v-team channel-matrix recommendation.
- **[reports/current-skill-shelf-status.md](./reports/current-skill-shelf-status.md)** — the current
  cross-package SKILL.md evidence, its measurement maturity, and the next experiment.
- **[reports/](./reports/)** — per-package eval reports.
- **[templates/canonical-grounding-pr.md](./templates/canonical-grounding-pr.md)** — the PR template.
