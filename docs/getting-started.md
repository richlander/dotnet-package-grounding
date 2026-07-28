# Getting started

This repo is **generic infrastructure** for measuring whether a package's skills help an AI agent use
that NuGet package correctly. You write a skill shelf for your package, write a suite of tasks a
developer would really bring to it, and run an agent over them twice — once with the shelf, once
without. What comes back tells you whether the shelf earned its keep.

This page is the **map of the whole workflow**. It walks the stages in order, says who should drive
each one, and hands you off to the document that owns the details.

If you want the concept before the process, read [`overview.md`](./overview.md) first.

## Start by reading a finished one

[`examples/markout/`](../examples/markout/) is a complete, shipped result, and it is the quickest way
to see what you are being asked to produce. It is laid out exactly as it sits in the Markout repo:

```text
examples/markout/
  skills/                     # what ships to users, inside the package
    markout/SKILL.md          #   base skill, named after the package
    built-in-shapes/SKILL.md  #   domain skills, pulled only when a task calls for them
    ...
    plugin.json               #   installs the set together
  grounding/markout/          # what measures it, and never ships
    meta.yaml                 #   which package this is for
    eval.yaml                 #   the graded tasks, with their assertions
    fixtures/                 #   the code each task starts from
    results.md, charts/       #   what the runs showed
```

Two directories, two audiences. **`skills/` is the product** — it ships inside the NuGet package and
is the only part a consumer ever sees. **`grounding/` is the instrument** — tasks, fixtures, and
results, which stay in the repo.

Keeping them apart is what keeps the measurement honest. You are free to rewrite the shelf as often
as you like; editing the suite so the shelf looks better is how you fool yourself.

Everything under `examples/` has this shape, because each one is a stand-in for a real package repo —
the two directories copy across verbatim when a shelf goes home. (`experiments/` holds our own
delivery-channel trials. Those are arms of an experiment, not models to copy.)

## How the work divides between you and the agent

The workflow is mostly mechanical, and agents run the mechanical parts well: building fixtures,
running the suite, collecting artifacts, drafting the PR. Three things are not mechanical, and they
are where your attention pays for itself.

**You own the tasks.** The suite is your definition of what using the package well looks like, so it
has to come from real workflows rather than from what a model expects to be asked. Models can
propose scenarios; coverage, prompt fairness, and assertions need you.

**You own what differentiates.** Two things sit here: finding the library patterns that carry real
workflows, and knowing which of them make your package worth choosing. The eval will probably
produce worse results than you expect at first, which may be a result of a poorly written skill,
weakly worded questions, or even unintuitive library APIs.

**You own what is true.** True in both senses, accurate and worth having. An agent asked to author
grounding writes from the same model knowledge the grounding exists to correct, and the iteration
loop rewards fitting the skill to the 24 prompts in front of it. What ships has to hold for other
users, other environments, and other workflows than the ones you tested.

Everything else can be delegated.

## The workflow

### 1. Start with the baseline, and find the trap

Before writing anything, run the ungrounded arm against the package and watch where the agent goes
wrong. If the baseline already scores well and never resorts to **archaeology** (decompiling your
assembly, rummaging the NuGet cache, searching the web), the model already knows your package and
there is nothing to author. Grounding is justified only by a measured gap.

When it does fail, the failures name your target: the wrong API, the deprecated entrypoint, the
renamed type, the workflow nobody guesses.

> **Agent:** runs the baseline, collects transcripts, summarizes where runs failed and where the
> agent went digging. **You:** decide whether each failure is a real gap in the package's story or a
> bad task. This needs first-party knowledge and cannot be outsourced.

**Owns this stage:** [`grounding-lifecycle.md`](./grounding-lifecycle.md) §0.

### 2. Author the skill shelf

Write additively from an empty baseline: record **only what the model is proven to lack**. The shape
that has worked for us is a small base skill named after the package, carrying the pattern every
task needs, plus domain skills the agent pulls only when a task calls for them.

> **Agent:** drafts structure, tightens the `description` hook, checks each claim is first-party and
> package-local, keeps skills inside the size budget. **You:** supply and verify the facts. Every
> claim should trace to release notes, source, or an observed baseline failure, never to what a
> model believes about your package.

**Owns this stage:** [`authoring-principles.md`](./authoring-principles.md) for the rules,
[`skill-shelf-methodology.md`](./skill-shelf-methodology.md) for how a shelf composes.

### 3. Write the eval suite

Grounding is only as trustworthy as the suite that tests it. The live standard is **CT-24**, a fixed
per-package suite of 24 graded tasks ordered roughly from what a developer meets on day 1 to what
they meet on day 100, each with fixtures and assertions that gate on a real build or test.

> **Agent:** builds fixtures, writes assertions, wires the scenarios up. **You:** choose the tasks
> and check the assertions actually test the behavior rather than the phrasing. Watch for tasks that
> exist because the skill exists.

**Owns this stage:** [`grounding-eval-methodology.md`](./grounding-eval-methodology.md) §2 for suite
design, [`eval-protocol.md`](./eval-protocol.md) for the rules that keep a run honest.

### 4. Run it

Paired arms, baseline and grounded, k=5 runs per task, across a weak, mid, and frontier model,
because the answer differs by tier. Runs are scrubbed of local tooling so a tool cannot silently
substitute for the grounding under test.

> **Agent:** this stage is entirely mechanical. Hand it over, or put it in CI. **You:** nothing,
> until it finishes.

**Owns this stage:** [`running-eval.md`](./running-eval.md) to point the harness at a package repo,
[`harness.md`](./harness.md) to build the machinery and understand the confounds.

### 5. Read the card

A run becomes a ship or no-ship call through the **quality card**: two axes, return and efficiency,
and two gates. A grounded arm has to deliver more, or deliver the same for less, and it must not
regress what already worked.

> **Agent:** computes the card, dumps the tables, flags high-variance scenarios. **You:** judge
> whether the win is real. A suite-level gain can hide a per-task regression, and a per-scenario
> verdict does not hold under high variance. The card is designed to make that visible, but somebody
> has to look.

**Owns this stage:** [`quality-card-model.md`](./quality-card-model.md) for the model,
[`scoring.md`](./scoring.md) for reading and reporting one.

### 6. Iterate

Run, find where the grounding falls short, patch the shelf **for the workflow rather than for the
task**, repeat. Failures do not all have the same cause, and reading them correctly is a skill in
itself: a task can fail because the skill was never pulled, because it was pulled and said nothing
useful, or because the library itself has a bug worth fixing.

> **Agent:** re-runs, diffs cards between iterations, proposes edits. **You:** refuse fixes that
> only work on the tasks in the suite. This is the stage where measurement quietly turns into
> overfitting.

**Owns this stage:** [`eval-protocol.md`](./eval-protocol.md).

### 7. Ship, then keep measuring

A grounding PR carries its evidence: the card, the dataset, the model list, and the caveats. After
it ships, the clock starts. The next model generation may already know what you just wrote down, and
the next release of your package may invalidate it.

> **Agent:** assembles the evidence package and fills the PR template. **You:** sign off on the
> claims, and schedule the re-measurement. Grounding that is never re-evaluated is grounding you can
> no longer vouch for.

**Owns this stage:** [`grounding-lifecycle.md`](./grounding-lifecycle.md) for create, update,
delete, and re-evaluate, plus the [PR template](./templates/canonical-grounding-pr.md).

## Setting up

Prerequisites, building the `grounding` CLI, and building the `skill-validator` harness are all in
[`harness.md`](./harness.md). Once the CLI is on your PATH, [`running-eval.md`](./running-eval.md)
is the shortest path to a first run against a package repo.

## Reference

- [`overview.md`](./overview.md) — the concept and the method in one pass.
- [`iet-model.md`](./iet-model.md) — the fused cost metric the efficiency axis is built on.
- [`quality-card-spec.md`](./quality-card-spec.md) — the normative spec, including the invariants
  that keep a card from lying to you.
- [`delivery-methodology.md`](./delivery-methodology.md) — measuring delivery itself, when the
  question is whether the agent pulls the skill at all.
- [`recommendation.md`](./recommendation.md) — what we concluded about delivery channels.
- [`reports/`](./reports/) — per-package measurement records.
