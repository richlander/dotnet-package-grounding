# Pull grounding delivery — evaluation methodology

> **New here?** Grounding ships as a **pull-installed `SKILL.md` skill set** — the agent invokes it
> on demand. This doc explains how to measure that delivery honestly, so a *delivery* miss (the agent
> never invoked the skill) is never mistaken for a *content* miss (the skill was invoked and still
> didn't help). For **how we grade and ship**, read the ratified
> **[quality-card model](./quality-card-model.md)**: return + efficiency, gated on do-no-harm and a
> ≥20% cost win.

Grounding is delivered **pull**: a model-invoked `SKILL.md` skill set the agent must *discover and
activate*. That is the one risk pull carries — the content only helps in the sessions where the agent
actually reaches for it. This doc is the discipline for measuring that risk without fooling yourself,
because the numbers feed a ship decision.

## Where this sits: two levers, two outcomes

Grounding is judged on two **outcomes** — does it let the agent answer **more** questions
(*capability / reach*) and answer them **more cheaply** (*efficiency / cost*) — moved by two
**levers**: the **content** (what the skill says) and the **delivery** (whether that content reaches
the agent). Delivery is **not a third outcome**; it *modulates* both. This doc is the **delivery**
lever; the content lever's reach/cost-vs-difficulty curve is the LIET axis (see
[Composition](#composition-with-the-content-axis-liet)).

**Pull delivery has one failure mode: non-activation.** A `SKILL.md` skill only enters context if the
agent invokes it, so its value is gated by an **activation rate** (0–100%) and, even when it does
fire, by a **mid-session position penalty** — it lands *after* the agent has already explored, not at
t=0. Both are properties of delivery, not of the content, and both are measurable.

## The measurement oracle: always-delivered

To separate a delivery miss from a content miss we need a control where the content is present **by
construction**, so activation can't confound it. The harness provides one: `--delivery push` places
the grounding body in context at turn zero (~100% activation). **This is a measurement instrument, not
a shipping mode** — we ship pull; we run the always-delivered arm only to read the content effect with
the activation lottery held constant.

| | Pull (shipped) | Always-delivered (oracle) |
|---|---|---|
| Harness flag | `--delivery pull` (default) | `--delivery push` |
| When the body enters context | only if the agent invokes the skill | turn zero, by construction |
| `read grounding %` (activation) | a real, measured rate (0–100%) | ~100% by construction |
| Role | the delivery we ship and grade | a control that isolates content effect |

The grounding body is identical in both arms — **only whether and when it arrives differs.**

## The decomposition (read this before running anything)

Pull's shortfall against the always-delivered oracle is bounded by how often pull fails to deliver:

```text
pull_shortfall  ≈  content_trajectory_effect  ×  (1 − pull_activation_rate)
```

- **Where pull already activates** (e.g. a frontier model that reliably invokes the skill), pull and
  the oracle deliver the *same content* → they match on trajectory. Pull loses nothing.
- **The shortfall lives entirely in the sessions pull misses.** So pull's delivery risk is
  *regime-dependent* — it is large only where activation is low (often a weaker model on a harder set).

Consequences for the experiment:

1. **`read grounding %` (activation) is the pivot metric** — always report it.
2. **A low activation rate is where pull delivery is most at risk** — measure activation first; a
   harder/broader set, or a smaller model, is where the agent skips the skill.
3. **Never read a content conclusion off a low-activation pull run** — the number convolves activation
   and content; only the always-delivered oracle isolates content.

## The four instruments — decompose pull into activation and position

The single "pull" arm blends two questions the decomposition keeps apart. Measuring **four**
instruments separates them — and all four are a **filter on existing data** (shared baseline + oracle
arm + pull arm + per-scenario activation flags), **no new run**:

1. **Baseline** — the model betting on itself; the **difficulty ruler**. Every other number is a
   delta from it.
2. **Always-delivered (oracle)** — content present at ~100%: the pure **content effect** at each
   difficulty, with activation held constant.
3. **Does pull activate** — a pure **delivery probability** (a rate, not a cost curve): did the model
   decide to reach for the skill. A property of the trigger, the harness, and the model's disposition —
   not of whether the content is good.
4. **Pull given activation** — content effect **conditioned on** delivery having happened; directly
   comparable to the oracle, because now both had the content present.

The factorization `pull_shortfall ≈ content_effect × (1 − pull_activation)` reads off these: (2) is
`content_effect`, (3) is `pull_activation`, and **(4) vs (2) is the decisive test**:

- **(2) ≈ (4)** → pull's only disadvantage is the activation lottery. The decision collapses to
  "what is the activation rate, and can you raise it" — a **delivery** fix (a sharper "use when"
  trigger), *not* a content fix.
- **(2) ≠ (4)** → the delivery mechanism affects the content's value **even after both delivered** —
  a **position effect** (the oracle lands the doc up front; pull injects it mid-session, into the
  tail, after the model has already reasoned). That routes to a positional fix (a leaner body, an
  earlier trigger). The two-number "pull vs oracle" comparison blends these into one loss and cannot
  tell you which lever to pull.

**The position effect is falsifiable — measure it, don't assert it.** The (2) − (4) gap should equal
the **pre-activation cost**: in a pull-given-activation session the doc lands only when invoked, so
every turn before that ran effectively un-grounded (baseline). The harness records *when* the skill
fired, so sum the turns/IET spent before it; if the gap ≈ that pre-activation cost, the position
mechanism is **confirmed**. If the gap is *larger*, the model reasons worse over a tail-injected doc
than a front-loaded one even once both are present — a separate, structural position cost.

**Selection-bias trap — compare (2) vs (4) at matched rungs, per run.** (4) is conditioned on the
model *choosing* to activate, and it chooses when it senses it is out of its depth — the harder rungs
— so (4)'s correct-set skews hard, and comparing it to the oracle's full curve is apples-to-oranges.
At low `n` the conditioning is per-**(rung, run)** (a rung can activate on some runs and not others).
Compare (4) to (2) **only on rungs that activated on all `n` runs** (or weight by per-run activation);
never as aggregate averages — otherwise the activation lottery leaks back in through the composition
of the correct-set, the exact contamination the split exists to kill.

## Confounds and the controls that remove them

| Confound | Symptom | Control |
|---|---|---|
| **Per-run baseline variance** | each delivery run computes its own baseline; at low `runs` the baselines diverge (we observed 4/6 vs 6/6 tasks and 74k vs 96k IET for the *same* ungrounded model) | **Shared pinned baseline** — `--baseline-out` once, `--baseline-from` for the other arm, so the pull and oracle arms compare against the **same** baseline |
| **Low statistical power** | one run is dominated by session noise | **`runs ≥ 3`**; report variance (skill-validator's CV / high-variance flag) |
| **Judge noise** | the pairwise judge wobbles near the floor and mis-scores truncated transcripts (we saw a −66% "judge" score on a run that solved 6/6 tasks) | **The functional gate governs** — `tasks correct` and `func passed (assertions)` decide; the judge score is advisory |
| **Content drift** | comparing different bodies | same grounding body, same scenario set; delivery is the only variable |
| **Turn-budget artifact** | the doc tax is `≈ 0.1 × doc_tokens × turns`, so a per-rung/session IET edge can move with the harness turn budget or the model's reasoning effort rather than the content | **fix turn budget + reasoning effort** across the compared arms; **log turns-per-rung** and check any IET crossing against it (see [eval-protocol.md](./eval-protocol.md) rule 9) |
| **Regime blindness** | reading content off a run where pull didn't activate | measure pull activation first; select the regime deliberately (see the decomposition above) |

## Metrics to report

- **`read grounding %`** — activation; the delivery-discriminating metric.
- **`tasks correct` / `func passed`** — the functional gate (the outcome that governs the grade).
- **Trajectory** — `Session turns`, `tool calls (web/bash/other)`, `nuget archaeology`, `Session IET`.
- **Grade** — the **[quality-card](./quality-card-model.md)** verdict (graded yield on the
  `Fails < Satisfies < Delivers` ladder + the two ship gates); the functional gate is the hard gate.

## The reproducible procedure

```bash
# 0. Select the scenario set. Measure pull activation per model first (a pilot run);
#    low activation is where pull delivery is most at risk.

# 1. PULL arm (shipped) — runs the baseline AND the pull-grounded arm, and PINS the baseline.
grounding run <unit> --source skill --delivery pull  --model <M> --runs 3 \
  --tests-dir <set> --out <data-dir> --baseline-out <dir>/bl-{model}.json

# 2. ORACLE arm (always-delivered) — reuses the SAME pinned baseline (skips the baseline arm).
grounding run <unit> --source skill --delivery push  --model <M> --runs 3 \
  --tests-dir <set> --out <data-dir> --baseline-from <dir>/bl-{model}.json

# 3. Render and compare. Both datasets now share one baseline, so the pull-grounded vs
#    always-delivered contrast is clean.
grounding analyze <data-dir>/<unit>.<M>.json       --view doc-card   # pull   (baseline -> pull-grounded)
grounding analyze <data-dir>/<unit>-push.<M>.json  --view doc-card   # oracle (same baseline -> always-delivered)
```

Run every model you care about, including at least one **frontier control** (expected to activate
under pull ~100%, so pull ≈ oracle) alongside the **needs-it tier** (where pull activation is low).
The control is what proves pull delivery does not *silently fail* the easy case.

## Reading — and defending — the result

- **Pull activation ≈ 100% (frontier control):** expect pull ≈ oracle on trajectory. Report it that
  way. Pull delivery is adequate here; there is no activation gap to close.
- **Pull activation low (needs-it tier):** the oracle recovers the content win in exactly the fraction
  pull missed — i.e. a sharper trigger (a better "use when" description) would capture it. This is the
  actionable case, and it is only credible with the shared baseline and `runs ≥ 3` in place.
- **The grade is the quality card**, goal-aware; the functional gate is the hard gate, the judge score
  a signal.

## Composition with the content axis (LIET)

This doc is the **delivery** axis. It is orthogonal to the **content** axis — the Levelized-IET
(LIET) curve, which plots per-rung IET vs difficulty for baseline / `SKILL.md` and is computed
**always-delivered** (delivery held constant at ~100%, so the activation lottery can't smear the
content curve). The two compose only at the **ship call**:

- **LIET (content)** answers *which content reaches each difficulty rung cheapest when always
  delivered* — a pure content-reach hurdle.
- **This doc (delivery)** supplies the missing economics: because we ship pull, `SKILL.md`'s doc tax
  is **pull-amortized** — paid only in the `activation` fraction of sessions. The ship decision
  discounts LIET's always-delivered content hurdle by the measured activation rate. Keep the two
  numbers separate; each then means one thing.

One coupling worth stating because it affects both axes: the doc tax is **turn-coupled and
endogenous**. When the body is present it is a cache-read on *every* turn — so its cost is
`≈ 0.1 × doc_tokens × turns`, and grounding *removes* turns (fewer exploration turns), so a body that
works **shrinks its own tax**. It is not a flat offset. Definition, stated so it's checkable in the
logged data rather than inferred from a shape:

> **The harm region is exactly the rungs where the body adds tax without removing exploration turns**
> — i.e. rungs where baseline already had ~0 archaeology (nothing to remove) so the doc tax is pure
> overhead.

Diagnosing it therefore requires **turns split by kind** — exploration/archaeology vs irreducible —
per rung, not a single turn count ([eval-protocol.md](./eval-protocol.md) rule 9). We already count
archaeology per scenario, so this is a reporting change.

## The content ledger — attributing content to assertions (LIET's dual)

LIET measures the per-rung benefit *magnitude*; the **content ledger** attributes that benefit to
specific `SKILL.md` blocks. It is a filter over the *same* per-scenario data (no re-run):
`grounding ledger <datasets>`.

The unit is the **functional assertion**, and the evidence is the per-question **baseline↔grounded
diff** (assertions align by index across arms). Assertions are the right unit because they are
*curated and declared* — unlike what the agent happened to dig for, which is noise:

- `file_contains` (type 2) → the required **API id** (`Metric`, `MarkoutSerializer.Serialize`). The
  gold signal: it tests "did the code use API X", and X maps to the block documenting X.
- `run_command` (type 9) → the **correctness oracle** (build + expected-output regex); sets task pass.
- `reject_tools` (type 11) → the **archaeology guard**; a fail→pass flip = grounding removed the dig.

**Four rung cases** (the three real outcomes + a harm flag), from the diff plus the resource divide:

| case | assertion diff | resource divide | meaning |
|---|---|---|---|
| **correctness** | flip fail→pass | — | grounding enabled the task |
| **efficiency** | none | big IET/archaeology | same correctness, cheaper |
| **redundant** | none | small | grounding didn't matter for this model |
| **regressed** | pass→fail | — | grounding harmed (or n=1 noise) |

The assertion-diff is the **correctness** instrument; the IET/archaeology divide is the **efficiency**
instrument — the diff is *blind* to efficiency wins (they have no flip), so the two channels are read
together.

**Per assertion, a 2×2** of {covered by a block?} × {diff outcome} gives the actionable reads:

- covered + flip → **load-bearing** (content earned the win).
- covered + still-fails → **present but ineffective** (salience/quality, not coverage).
- uncovered + still-fails → **missing content** (author it).
- uncovered + flip → **uncredited** (win came from reasoning, not the doc — don't credit it).
- covered + both-pass → **redundant for this model** (may still serve a weaker one — read per-model).

A block that covers *no* assertion is an **orphan** — nothing tests it, so cut it or grow a rung.
Generalization falls out of the ladder: a block whose flips land on **held-out, harder rungs** (not
just the rungs it was authored against) is generalizing; flips only on its authoring rungs are a mild
overfit signal.

### One system: assertions grade *and* attribute

Because attribution rides on the assertions, **closing a ledger gap = adding a functional assertion**,
and that same assertion **hardens the eval gate**. One artifact, two payoffs, no separate instrument,
and the ledger stays a filter (no re-run). The discipline: add an assertion only when it encodes a
*genuine* task requirement — not to boost resolution — or you contaminate the correctness gate to
serve attribution.

The corollary is a **diagnostic**. An apparent "content-quality problem" partitions into four causes —
a real **content gap**, a **missing/imprecise assertion**, a **matcher** miss, or **n=1 noise**. An
imprecise or stale assertion produces a *phantom* content problem (the doc looks bad when the
measurement is bad). The ledger's own categories are the triage.

### Worked example — emergent content on `markout` CT8 / CT12

The ledger flagged two gaps: `CT8` *missing content* (`ShowWhenProperty` undocumented, grounded
failing) and `CT12` *uncredited flip* (`MarkoutUnwrap` undocumented). The loop: author the **minimal**
content for both → re-run *only* those two rungs (haiku, `n=3`) → re-ledger.

| | CT8 | CT12 | still-failing | missing | uncredited | load-bearing flips |
|---|---|---|---:|---|---|---:|
| **before** | regressed (grounded fails) | uncredited | 1 | CT8:ShowWhen | CT12:Unwrap | 1 |
| **after** | **correctness (grounded passes)** | **efficiency (credited)** | **0** | none | none | **2** |

Content added *because measured* — and the **line budget forced compression** (the additions busted
the limit, so both attributes were folded onto one bullet: emergent ≠ accumulation). The same run also
surfaced a real ledger bug — the assertion value is a lenient substring (`ShowWhen`) while the doc
writes the full identifier (`ShowWhenProperty`), so matching is by **identifier family**, not exact
token.

**Caveats.** Attribution is a correlational lexical (identifier-family) join at section granularity.
The assertion diff is **`run[last]`** in the dataset, so flip/regressed *counts* are `n=1` noisy — but
structural findings (`missing`, `orphan`) are robust across runs. Correctness that lives in the fixture
*output regex* rather than an API `file_contains` (a strong model producing the right output without a
distinctive API call) is **unattributable** until an assertion pins the API — the loop's own next move.

## Reading the low-activation run (a trap to avoid)

The two model-relative reads must come off **different arms**, or the activation lottery leaks back
into the content story the oracle just removed:

- **Presence premise** (does pull *fail to deliver* for the weaker model?) → read `read grounding %`
  on the **pull** arms. If haiku's pull activation on the hard tier is low, pull is failing to deliver
  and a sharper trigger should help.
- **Decay-migration** (does grounding's gap open at *earlier* rungs for the weaker model — the
  popularity/recency decay made visible?) → read the **always-delivered oracle arms only**, per rung,
  haiku vs opus. This is a *content*-axis result and is only clean where activation is pinned at 100%.

The trap: a **low-activation pull run convolves activation and content in one number**
(`pull_shortfall ≈ content_effect × (1 − pull_activation)`), so an "earlier gap" seen on pull data
could just be haiku under-invoking the skill — a delivery effect masquerading as content. The
low-activation run may *suggest* decay-migration; only the oracle arms *confirm* it.

## Honesty guardrails (the anti-overclaim checklist)

- [ ] Shared, pinned baseline across the pull and oracle arms (not two independent baselines).
- [ ] `runs ≥ 3`; variance reported.
- [ ] Pull activation stated; the content effect is read on the oracle arm, not asserted from pull.
- [ ] Functional gate (tasks/assertions) drives the grade; judge score labeled advisory.
- [ ] A frontier control included, to show pull delivery does not silently fail the easy case.
- [ ] No content claim from a `runs = 1` or unshared-baseline run. *(We made this mistake once — a
      lucky low baseline made a grounded arm look better than it was. The shared baseline exists to
      prevent exactly that.)*

The always-delivered oracle's properties — presence (it always fires), timing (turn zero), position
(stable front of the prompt) — are true **by construction** and need no experiment. The only
*empirical* questions are the **magnitude** of the content effect and **how much of it pull's
activation captures**, and that is what this methodology measures without fooling itself.

## Worked example — `markout`, runs=3, shared pinned baseline

A 6-scenario set, `runs=3`, one baseline pinned per model and reused across both arms (`--baseline-out`
on the pull run, `--baseline-from` on the oracle run). Baseline is byte-identical across arms (same
turns, archaeology, IET), so the grounded arms are directly comparable.

| | pull activation | shared baseline | pull-grounded | always-delivered (oracle) |
|---|---:|---:|---:|---:|
| **haiku** | 100% | 13 turns / 70902 IET | 9 turns / 55516 (−22%) | **5 turns / 33516 (−53%)** |
| **opus** | 100% | 12 turns / 97535 IET | 7 turns / 51788 (−47%) | **5 turns / 44596 (−54%)** |

**Reading it honestly:**

- **This is a *high*-activation regime, by measurement.** Both models activated the pull skill 100%
  of the time on the set — so per the decomposition, pull is *not* failing to deliver here, and the
  presence-driven shortfall `(1 − activation)` is ~0. This set cannot demonstrate the low-activation
  case; the harder tier (where a mini model skips the skill) is the separate experiment for it.
- **The oracle is nonetheless cheaper than pull at equal (100%) activation** — for both models,
  against the *same* baseline. That isolates a **timing/position** effect distinct from presence: even
  when pull eventually loads the skill, it loads it *mid-session* after the agent has explored, while
  the oracle has it at t=0. Under pull shipping this is the **residual position cost we accept**; it
  bounds how much a sharper trigger or a leaner skill body could recover. (Defensible here only
  because the baseline is shared — an earlier `runs=1`, unshared-baseline pass showed a spurious edge
  from a lucky low baseline, the exact trap the shared baseline exists to remove.)
- **Scope of the claim:** one package, one 6-scenario set, `n=3`. Enough to *observe* the timing
  effect cleanly; not enough to *size* it. Widen the set and raise `n` before quoting a magnitude.
