# dotnet-package-skills

This repo is about *skill grounding*: targeted instructions that are included in a package so that
an AI coding agent uses it correctly. As a package maintainer, you know the broad spread of user
scenarios, from the basics to advanced scenarios. Writing those scenarios as skills can provide your
users with a better experience when they ask agents to use your package. This repo was created as
the result of attempting to do just that and finding that doing a good job is very difficult without
a strong methodology. The primary product of our effort is a methodology and associated tools that
we're sharing so that this process is much easier.

The approach heavily leverages agents, based on a set of best practices (these are examples):

- **Effective:** Ask agents to write skills based on how your library is used in real apps.
- **Ineffective:** Ask agents to write skills based on their training or a first look at your
  library.
- **Effective:** Evaluate agent capability relative to a set of fixed tasks, comparing baseline to
  skilled across multiple models, each at least 5 times, in a controlled harness.
- **Ineffective:** Evaluate the use of a skill once by installing the skill in your agent
  environment.
- **Effective:** Repeat the exact same task with one variable changed, like Opus 4.8 -> Opus 5. Diff
  against the results.
- **Ineffective:** Repeat manual evaluation against your memory of the duration of the tasks and
  feel of model capability.

## What a package carries

Grounding is delivered as a **skill set**, or shelf. A package carries a **base skill** named after
the package, holding the pattern every task needs plus its everyday footguns, and a handful of
**domain skills** covering long-tail workflows that the agent pulls only when a task calls for them.

Markout is the package we have measured most, and its shelf is the worked example: a `markout` base
skill plus `conditional-composition`, `output-formats`, `built-in-shapes`, and
`composite-cells-cards`
([skills/](https://github.com/richlander/markout/tree/ce792b6d56cef3c5bd4060a284da2b03fd3c5553/skills)).
A `plugin.json` installs the set together, so the agent can pull whichever skill a task needs
without the others taking up room.

The files follow [Anthropic's Agent Skills](https://www.anthropic.com/news/skills) convention: a
`SKILL.md` with YAML frontmatter (a `name` and a "use when…" `description`) that discloses into
supporting files as the agent needs them. Any Skills-aware agent host can load them.

## What a skill buys: efficacy and efficiency

A skill can buy two different things, and it is worth deciding which one you are chasing before you
write it.

- **Efficacy.** The agent produces a correct result where it previously failed, or only succeeded
  some of the time. The quality card calls this axis *return*.
- **Efficiency.** The agent reaches the same correct result for less: fewer tokens, fewer tool
  calls, less wall-clock time.

It is easy to say "I could write a skill about the breaking changes in our last major version."
That may well be a good idea. But which of the two is it buying? Measure it. Today it may measure
well on both. Six or twelve months from now the next model generation may already know your breaking
change, and the efficacy win erodes to nothing. The efficiency win usually survives, because a
targeted skill still beats the agent rediscovering the answer by reading your README, decompiling
your assembly, or searching the web.

We have watched exactly this happen. `System.CommandLine` sat in beta for years, right through the
period the current models trained on, and then shipped 2.0 with breaking changes. For a while models
were reliably confused, and a skill correcting them would have been a large efficacy win. That
window has since closed. The efficacy case for a stale-knowledge skill has a half-life set by the
training runs, not by you.

We see this in our own numbers. A frontier model sits near the ceiling already, so its win is almost
entirely efficiency, while weaker models gain both. The same pattern holds across model
generations: correctness converges as models improve, and the efficiency gap is what stays legible.
The [findings](#what-we-found) below carry the detail.

Efficiency is a perfectly good target on its own, and it compounds in a way efficacy does not: one
session has many turns, one developer has many sessions, and one company has many developers. A
durable 20% is worth having.

Just be clear that efficiency is the target, and be willing to check rather than assume. The reason
to hold that bar is that a skill is not free. It occupies context and is spent against your users'
token budgets, on every task where the agent pulls it. A skill that merely ties the baseline is a
cost you have handed to them for nothing.

## How a claim is tested

Every claim here is backed by a paired experiment. The same agent attempts each task once without
the grounding and once with it, `k = 5` runs per arm, across a mini *and* a frontier model, on the
**CT-24** suite (24 graded tasks, from day-1 common usage to day-100 niche). We reuse the
[`dotnet/skills`](https://github.com/dotnet/skills) **skill-validator** harness to run those pairs
and compare accuracy, token usage, and tool calls using pairwise LLM judging.

The result is read with the [quality-card model](docs/quality-card-model.md): the two axes above,
return and efficiency, behind two ship gates (do no harm, plus a certified 20% economic win).

How grounding *reaches* the agent turns out to matter as much as what it says. A skill set that
installs into the consuming repo is one route, where the agent opts in and the consumer can see and
remove it. Packing a doc inside the `.nupkg` so it arrives on restore is another, and it is the
route the NuGet MCP server and `dotnet-inspect` read from. We treat the delivery channel as
something to [measure](#what-we-found) rather than assume.

## How to read this

- **As a how-to.** Practical instruction for authoring package grounding: what to write, what to
  leave out, and how to validate it, grounded in worked examples for real packages.
- **As a record of our approach.** These patterns are our approach to **context engineering**, by
  which we mean something concrete: what to add to an agent's context, and how to limit it. Which
  delivery channel surfaces grounding, how agents retrieve it, when it helps versus hurts, and the
  evidence behind each call.

If the idea is new to you, [`docs/overview.md`](docs/overview.md) covers the concept in one pass.
The harness mechanics live in [`docs/harness.md`](docs/harness.md); this page is about the concept
and the findings. How we evaluate a grounding change and decide whether it ships, including the
methodology, terms, threshold gate, and evidence dump, is the
[grounding eval methodology](docs/grounding-eval-methodology.md).

## How we measure cost: IET

Our measuring stick is **IET**, or Input-Equivalent Tokens: a single cost-equivalent number that
normalizes each token class to fresh-input units:

```
IET = fresh + 0.1·cacheRead + 1.25·cacheWrite + 5·output
```

where `fresh = inputTokens − cacheReadTokens` is Anthropic's **Base Input Tokens** at 1× (the
SDK's `inputTokens` is cache-read-inclusive, verified against every dataset, where cacheRead never
exceeds it). The formula maps 1:1 onto Anthropic's four billed categories (Base / cache read /
cache write / output). This **diverges from the `dotnet/skills` harness
metric**, which reports an unweighted `tokenEstimate = inputTokens + outputTokens` (cache reads
counted at full price, output counted the same as input). We diverged because that estimate
inflates the exploration-heavy raw baseline, so the channel that does the most cheap prompt-cache
reads looks the most expensive, and it undercounts output, which is the dominant real cost. The
weights are **Anthropic's published pricing multipliers**
([price sheet](https://platform.claude.com/docs/en/about-claude/pricing)): cache read **0.1×**
base input, 5-min cache write **1.25×**, and **output 5×**, uniform and exact across current Claude
models (Opus 4.8 $5→$25, Sonnet $3→$15, Haiku 4.5 $1→$5; see also
[dotnet/sdk#54417](https://github.com/dotnet/sdk/issues/54417)). So the
weights also expose the **arbitrage** between classes: spending cheap cached input to avoid
expensive output is a win the unweighted metric can't see. Cross-channel comparisons then reflect
spend rather than cache-read volume. Tables still cite the harness's raw `tokenEstimate` (`tEst`)
in parentheses for traceability. Full derivation:
[`docs/recommendation.md`](docs/recommendation.md) (Metric) and
[`docs/delivery-and-retrieval.md`](docs/delivery-and-retrieval.md).

## How we measure the lift: the quality card

We want two things from a grounding change: proof it **helps**, and a number we can **trust**. The
hard part is that a coding agent's behavior on a task isn't a bell curve. It is **multi-modal**. Run
the same task five times and the runs don't scatter around an average; they land in distinct
*modes*: some deliver a working, idiomatic result, some produce broken or off-spec output, some
flail and give up. Averaging a "score" across those modes is meaningless, because the mean sits in a
valley no run ever occupies. (The analogy: a school measuring classrooms whose grade distributions are
multi-modal can't summarize them with a single median; it has to name the modes first.)

So we **define the modes by contract** instead of discovering them from noise. Every run is graded
on a fixed ladder, **Fails < Satisfies < Delivers**, where the tiers are *verifiable
requirements* (did it use the taught API, hit the technical constraints, and functionally work),
never subjective taste. Then we measure two **independent** axes behind two gates:

- **Return**, how often it delivers (over **all `k` runs of each task**, so a failed run stays in as
  a scored 0). An arm's **yield** on a task is `K/k` (its delivered runs out of `k`); the suite figure
  is the equal-weight mean of those per-task yields (equal *task* weight, not equal run weight).
  Grounding's return lift is the change in yield, baseline → grounded. Because five runs is a noisy
  estimate of a rate, we report it as a **band** (a 95% credible interval) rather than a point, so
  *mode-jumping between runs shows up as reliability*, exactly where it belongs.
- **Efficiency**, the price *and* speed of a delivery (over **delivered runs only**, so a task's
  denominator is its `K` deliveries, so a mode an arm never reached is never priced or timed). Among
  runs that deliver, we levelize two rulers and band each as a paired, per-task geometric-mean ratio,
  grounded vs. baseline: **per-dollar** cost in [IET](#how-we-measure-cost-iet), the fused price that
  carries the retry tax and our economic headline, and **per-day** duration (wall-clock on one fixed
  host, so the machine constant cancels in the ratio). This is where a good skill pays for itself: it
  stops the agent from decompiling the package and web-searching the API. Cost gates; speed
  co-headlines.
- **Gate 1, do no harm.** Grounding must not cause a **material regression** on any task (one the
  baseline delivered but the grounded arm doesn't). We calibrate the gate against a null model, so
  normal run-to-run noise can't trip it. Only a real, sustained loss will. The principle is
  [Pareto improvement](https://en.wikipedia.org/wiki/Pareto_efficiency): improve things generally,
  harm no one model in particular. You do not get to choose which model your users bring, and
  routers can switch it mid-task without telling anyone, so a change that lifts the frontier while
  regressing the mini is not a win.
- **Gate 2, earn its keep.** The per-dollar win must clear a **≥20% floor with confidence** (the
  band's upper bound ≤ ×0.80), the minimum premium that repays authoring the skill and maintaining
  it as models drift. This is the number a semiconductor CEO would put on an earnings slide: a
  committed margin, not a curve. A real-but-tiny 8% win passes *do no harm* yet fails here, and is
  correctly judged "not worth maintaining."

Two rules keep the card honest. **Never price or time an empty mode:** if an arm never delivers a
task, we do *not* invent a cost or a duration for it. That is a **capability gap** (a coverage row: a
task grounding *unlocks*), counted separately from the efficiency axis, never averaged into it. (This
is why return is scored over all runs but efficiency only over deliveries.) And **only the certified
path is graded**, meaning deterministic verifiable requirements, so the headline numbers don't ride
on judge opinion. The full model, the band procedure, and the claims-to-evidence taxonomy are in
[`docs/quality-card-model.md`](docs/quality-card-model.md) (spec:
[`docs/quality-card-spec.md`](docs/quality-card-spec.md)); a worked three-model result is
[Markout CT-24](https://github.com/richlander/markout/blob/skills/markout-consumer/grounding/markout/results.md).

The consistent finding across model tiers: **grounding buys more as capability falls.** At the
frontier the model is already near the ceiling, so the win is almost entirely **efficiency** (a
delivery gets cheaper and faster). For weaker models it is **both**: grounding unlocks tasks they
never delivered, and slashes the cost and time of the ones they did.

## What "grounding" is, and what it is not

Several different things get called a `SKILL.md` skill set. They live in different places, serve
different audiences, and should not be confused. This repo is about exactly one of them, the first
row.

These definitions are up for debate and may differ by domain or community. We define them a
particular way here for the purposes of measurement and guidance for the package-grounding
feature.

| Artifact | Where it lives | Who consumes it | Purpose | In this repo? |
|----------|----------------|-----------------|---------|---------------|
| **Package grounding**, a `SKILL.md` skill set | authored for a **NuGet package** and installed into a **consumer's** repo (pulled, opt-in, removable) | an AI agent working in a *consumer's* project that depends on the package | the model may already know the package's common, everyday usage, so we *measure* what's resident rather than assume it. We **target the footguns**, the non-obvious gotchas it is *proven to lack* (anti-flailing), so it avoids latent bugs against *that dependency* | **Yes, the artifact under test** (`grounding/<slug>/SKILL.md`) |
| **Marketplace `SKILL.md`** | published as a `plugin.json` plugin in a **skills marketplace** (the `dotnet/skills` distribution model) | an agent *host* that installs marketplace plugins globally | a distributable, installable capability/instruction set | **No, explicitly out of scope.** This repo has no `plugin.json` marketplace machinery |

The distinction that matters: **package grounding is authored for a specific dependency and pulled
into the consumer's repo on demand**, when an agent works in a project that references that package.
A marketplace skill, by contrast, is installed globally into the host. Everything below is about
package grounding.

## Grounding vs. skills: our policy

Skills and grounding are delivered the same way: both are `SKILL.md` skill sets that a consumer
**pulls** into their repo (opt-in, user-visible, removable). What separates them is **scope**, not
installation:

- **A general skill** is a *procedure* or multi-component workflow: "how *we* do CI here", "how to
  publish to NuGet". It spans tools and repos, and the user loads it because the *need is visible*:
  the agent recognizes "this is a NuGet-publishing task" and pulls the publishing skill.
- **Package grounding** is a *first-party, package-local* skill set authored for one dependency.
  Its highest-value content is the *silent* gaps a model doesn't know it has, the footguns it
  can't recover by compiling. It is installed only when an agent works in a project that references
  that package.

Because grounding ships under a package's name and is trusted by consumers who depend on that
package, it earns a **stricter discipline** than a general skill (full treatment in
[`docs/authoring-principles.md`](docs/authoring-principles.md)):

1. **Stay in your lane.** Assert only **first-party, package-local facts**: your overloads, your
   footguns, your beta→stable renames. The moment a skill describes a workflow *across* components,
   it has become a general skill and left its lane. This bounds the blast radius: a skill that only
   ever names its own package cannot mislead about one it never mentions.
2. **Do no harm, and earn your keep.** Ship grounding only when the measured quality card clears
   **both gates**: it does **no meaningful harm** to any model tier (the do-no-harm floor) **and**
   it delivers a **material economic win**, at least a **≥20%** cut in cost-per-delivery, to the
   tier that needs it. A skill set that merely ties the baseline doesn't earn the maintenance it
   costs.

> The two gates are the ship rule from the **[quality-card model](docs/quality-card-model.md)**: a
> do-no-harm floor (loss mass no worse than luck alone) and a ≥20% economic-materiality gate on
> cost-per-delivery, over a graded-yield return axis (*Fails < Satisfies < Delivers*) and a
> per-dollar efficiency axis. See that doc for the full model and its analogies.

## What we found

We authored and measured grounding for four real packages (**System.CommandLine**,
**System.Text.Json**, **Microsoft.Extensions.AI**, and **Markout**) across two tasks. The
recognizable packages double as the readable examples. **Markout is a deliberate control**: an
obscure, source-generated serializer the models genuinely *don't* know, which is exactly why it
gives a clean grounding signal (a model-resident package like System.Text.Json would mask it). The
headline results are in weighted [IET](#how-we-measure-cost-iet) (`tEst` = unweighted harness
estimate, shown for traceability); full tables, method, and caveats are in
[`docs/recommendation.md`](docs/recommendation.md).

1. **On a real migration, grounding cuts cost the most.** The flagship task is a **System.CommandLine
   `beta4` → 3.x migration** (the agent must build, localize the breakage, and migrate) with two
   distractor packages. runs=3:

   | Channel | what the agent gets | Opus IET | Haiku IET |
   |---------|---------------------|---------:|----------:|
   | **A** raw package, no MCP | finds + reads the **README** | 188k | 939k |
   | **B** NuGet MCP, no grounding doc | server returns the **README** | 138k | 665k |
   | **D** MCP + resident index | curated grounding, self-gated | **92k** | **286k** |

   That's **−51% (Opus)** and **−70% (Haiku)**. The raw baseline *thrashes*, with Haiku burning 99
   tool calls, and the resident-index channel is also the **only** one that surfaces silent,
   compile-clean gotchas the agent wouldn't know to ask for.

   *Is this a one-off, or repeatable?* Repeatable, because of **where the value sits**. We measured
   five scenario shapes for System.CommandLine ([report](docs/reports/system-commandline.md)) and the
   pattern was consistent: general API shape, greenfield authoring, idiomatic usage, and the
   command-line-parser domain itself are **already in the model**, where grounding moves the needle
   −2% to +1% (that is, not at all). The signal concentrates almost entirely in the **non-resident delta**:
   version-specific breakages and *silent* gotchas (the canonical one being the `Option<T>` constructor
   whose second argument flipped from *description* to *alias* between beta and GA, code that compiles
   and looks right but behaves wrong). That is the general shape of grounding's value: the model carries
   the bulk; grounding carries the **footguns the model can't recover by compiling**.

   This shapes *who* writes grounding and *how*. Because the payload is the non-obvious delta, you
   can't auto-generate it from the public API surface. It is a combination of **expert view** (a
   maintainer's judgment of what actually trips people up) and **hard-won experience** (the silent
   gotchas surfaced by real bug reports and migrations). The role of our harness is to **keep that
   instinct honest**, measuring each candidate fact so only the lines that change agent behavior
   ship, and the merely-nice-to-know ones don't.

   There is a **circularity** to watch for when *generating* grounding. You can't use Opus 4.8 to
   author grounding *for* Opus 4.8. If Opus can produce the fact on request, it already knows it,
   so the act of writing it down only proves it's redundant. The productive direction is
   **asymmetric**: use the strong model to author grounding for the *weaker* ones (Sonnet, and
   especially Haiku). That is essentially **distillation**, where the frontier model's resident
   knowledge becomes the weak model's shipped context, and it almost certainly helps the tier that
   needs it.
   The constraint is the other half of the asymmetry: **don't harm the strong tier in the process.**
   Opus tokens are far more expensive, so grounding that bloats or misleads the frontier to rescue
   the weak tier is a bad trade. Help the weak, no harm to the strong: the
   [do-no-harm gate](#grounding-vs-skills-our-policy), and the asymmetry, restated as a generation
   recipe.

2. **The clean mechanism, isolated.** On the controlled Markout probe we can run all five delivery
   channels (same task, same content, varying only delivery). runs=3:

   | Channel | what the agent gets | Opus IET | Haiku IET |
   |---------|---------------------|---------:|----------:|
   | **A** raw package, no MCP | finds + reads the **README** | 78k | 49k |
   | **A′** raw package, grounding doc present | *still reads the README*, so the grounding doc is **invisible** | 124k | 62k |
   | **B** NuGet MCP, no grounding doc | server returns the **README** | 38k | 40k |
   | **C** NuGet MCP, grounding doc present | server returns the **grounding doc** | **28k** | 39k |
   | **D** MCP + resident index | curated grounding, self-gated | 31k | **31k** |

3. **Content alone is worthless without a delivery channel.** Channel A′, grounding doc shipped but
   no MCP, is the *most* expensive cell on both tiers: the agent never sees it and reads the README
   anyway. Writing grounding only pays off when the MCP delivers it.

4. **The README is a measurable liability, and targeted value is size-invariant.** Sweeping the
   shipped README from 3 KB → 74 KB (24×) while holding the grounding doc at 3.5 KB: the README path
   tracks its own bloat (72k–117k IET, high-variance), while the grounding-doc path stays **flat at
   ~36–42k IET / 9–11 tools**, a **48–69% saving** that *widens* as the README grows. Full sweep:
   [`docs/reports/readme-liability.md`](docs/reports/readme-liability.md). How large real READMEs
   actually get, and how often a package ships none at all, is surveyed in
   [`docs/overview.md`](docs/overview.md#why-grounding-is-needed).

5. **For weak models it's correctness, not just cost.** The README-without-MCP path *fails* the weak
   tier; the delivered grounding doc flips it to a pass. Grounding rescues the tier that needs it
   while costing the frontier tier nothing: the do-no-harm gate above, met in the data.

## Start here: the recommendation

**[`docs/recommendation.md`](docs/recommendation.md)** is the executive summary for the NuGet
v-team. It answers two team decisions, **(1) should we author grounding content for packages?**
and **(2) should the NuGet MCP change?**, backing each with one progression (raw package → NuGet
MCP → shipped grounding doc → resident-index MCP) measured across **2 real tasks × 5 delivery
channels × 2 model tiers**, with raw data in [`data/`](data/) and worked grounding examples for
four real packages. The supporting deep-dives are
[`docs/authoring-principles.md`](docs/authoring-principles.md) (*what* to write),
[`docs/delivery-and-retrieval.md`](docs/delivery-and-retrieval.md) (*how* it reaches the agent),
and the per-package reports in [`docs/reports/`](docs/reports/).

## How a grounding doc is written

A grounding doc records **only what an agent is proven to lack** (by eval signal) and is written
for the **section-based RAG retrieval** paradigm rather than top-to-bottom reading, unlike a README.
It must stay **concise**, since retrieval quality falls as sections bloat. See
[`docs/authoring-principles.md`](docs/authoring-principles.md) for the principles and the
empirical evidence behind them.

The per-package reports under [`docs/reports/`](docs/reports/) are writeups suitable for an
upstream PR:

- [System.CommandLine](docs/reports/system-commandline.md) needs grounding for a narrow set of
  topics.
- [System.Text.Json](docs/reports/system-text-json.md) does **not** need general grounding.
- [Microsoft.Extensions.AI](docs/reports/microsoft-extensions-ai.md) shows that grounding need is
  **model-relative**: its headline gotcha is resident for Opus 4.6 (−1.0%) but a +63.3% rescue
  for Haiku 4.5.
- [Markout](docs/reports/markout.md) is a genuinely non-resident package whose grounding competes
  with the package's own README: do-no-harm + ~3× token efficiency at the frontier, and a
  fail→pass correctness rescue at the weak tier.
- [README liability](docs/reports/readme-liability.md) is a README-size sweep showing a lean
  ~3.5 KB targeted doc is **size-invariant** and beats a README of any realistic size (3–74 KB)
  by **~2–3×** (weighted IET), while README reliance is a high-variance, high-ceiling regime, so
  the lever is **completeness + targeting**, not a size ratio.

## Running the evals

The harness mechanics (building `skill-validator` from a pinned `dotnet/skills` SHA, the
`grounding/` + `tests/` layout, and how to add a package) are documented in
**[`docs/harness.md`](docs/harness.md)**. Quick start:

```bash
# Prereq: a .NET SDK matching dotnet/skills' global.json, git, and `gh auth login`.
eng/run-evals.sh System.CommandLine
```
