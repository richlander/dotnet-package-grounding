# dotnet-package-skills

This repo is about *skill grounding*: targeted instructions that are included in a package so that
an AI coding agent uses it correctly. As a package maintainer, you know the broad spread of user
scenarios, from the basics to advanced scenarios. Writing those scenarios as skills can provide your
users with a better experience when they ask agents to use your package.

This repo was created as
the result of attempting to add skills to a package for users, as a package maintainer, finding that writing good skills with high confidence on their utility is very difficult without
a strong context-engineering measurement methodology. The primary product of our effort is a methodology and associated tools that
we're sharing so that this process is much easier. It offers a practical instruction for authoring package skills: what
to write, what to leave out, and how to validate it, with worked examples for real packages.

The approach heavily leverages agents, based on a set of best practices. These are examples, and the
ineffective half of each pair is not a straw man; much of it is what we tried first, before the
measurements talked us out of it.

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

If the idea is new to you, [`docs/overview.md`](docs/overview.md) covers the concept in one pass.
The harness mechanics live in [`docs/harness.md`](docs/harness.md); this page is about the concept
and the findings. How grounding physically reaches the agent, which turns out to matter as much as
what it says, is [`docs/delivery-and-retrieval.md`](docs/delivery-and-retrieval.md). How we
evaluate a change and decide whether it ships, including the methodology, terms, threshold gate,
and evidence dump, is the
[grounding eval methodology](docs/grounding-eval-methodology.md).

## What a package carries

Grounding is delivered as a **skill set**, or shelf. A package carries a **base skill** named after
the package, holding the pattern every task needs plus its everyday footguns, and a handful of
**domain skills** covering long-tail workflows that the agent pulls only when a task calls for them.

Markout is the package we have measured most, and its shelf is the worked example: a `markout` base
skill plus `conditional-composition`, `output-formats`, `built-in-shapes`, and
`composite-cells-cards`
([skills/](https://github.com/richlander/markout/tree/main/skills)).
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

We have seen this pattern in our own numbers, on the four packages we have measured so far. Where
the frontier model already sat near the ceiling, its win was almost entirely efficiency: it was
already delivering the task, so the skill only made the delivery cheaper. The weaker tiers gained on
both axes at once, which is the more interesting case: they started delivering tasks they had been
failing outright (efficacy), *and* did the tasks they already managed for far fewer tokens
(efficiency). Read that as a shape to test for rather than a law: whether the frontier has headroom
on *your* package depends on how well it already knows it, and on a package it genuinely does not
know it can have a real capability gap too. The cross-generation version of the claim is thinner
still, resting on two Opus generations of a single package, so we would not lean on it yet. The
[findings](#what-we-found) below carry the detail and the caveats.

Efficiency is a perfectly good target on its own, and it compounds in a way efficacy does not: one
session has many turns, one developer has many sessions, and one company has many developers. A
durable 20% is worth having.

Just be clear that efficiency is the target, and be willing to check rather than assume. The reason
to hold that bar is that a skill is not free. It occupies context and is spent against your users'
token budgets, on every task where the agent pulls it. A skill that merely ties the baseline is a
cost you have handed to them for nothing.

## How a claim is tested

Every claim here is backed by a paired experiment. The same agent attempts each task once without
the grounding and once with it, `k = 5` runs per arm, across a mini *and* a frontier model. We reuse
the [`dotnet/skills`](https://github.com/dotnet/skills) **skill-validator** harness to run those
pairs and compare accuracy, token usage, and tool calls using pairwise LLM judging.

The tasks come from a fixed suite we call **CT-24**, for *complete textbook*: the set of questions a
library's documentation ought to be able to answer, ordered by difficulty from what you need on day
1 to the niche corner you hit on day 100. Twenty-four tasks is the standard size, chosen to cover
that range at a cost you can afford to run five times per arm on several models.

CT-24 names the *shape* of the suite. The contents are written fresh for each library against its
own surface, then held constant across every arm and model. A suite that only asks easy questions
will show any skill earning nothing, so it has to be able to tell the two arms apart before any
result from it means anything.

The technique that matters most here is to **derive the tasks from how the library is used in real
applications**, rather than inventing them from the API surface. Read real consumers, yours or other
people's, and turn what they actually do into tasks. Invented tasks tend to exercise the library the
way its own documentation already describes it, which is the same shape the model already predicts,
so both arms do well and the suite cannot tell them apart. Real applications combine features in
ways no example shows, and that is where an agent goes wrong and a skill has an answer on offer. The
same reading also tells you which parts of your API are load-bearing enough to be worth teaching.
The per-package specifics are in
[`docs/grounding-eval-methodology.md`](docs/grounding-eval-methodology.md).

The result is read with the [quality-card model](docs/quality-card-model.md): the two axes above,
return and efficiency, behind two ship gates (do no harm, plus a certified 20% economic win).

If you want to see the whole method run end to end on a real package, read
[markout#148](https://github.com/richlander/markout/pull/148). It is the best worked demonstration
we have: it ships the skill shelf, the 24-scenario eval that graded it, and the four-model quality
card with both gates and the verdict, in the form a package maintainer would actually review. It
also shows the parts that are easy to leave out of a writeup, including a fifth skill that was cut
for self-selecting only once on the ladder, and the decision to stop packing a doc into the nupkg.

One caveat when reading it: that PR ran for ten days and 39 commits, which is not what a shelf of
five skills should cost. The reason is that the skills and the methodology in this repo were
developed together, each one forcing changes in the other, so the history contains both the work and
the invention of the process used to do the work. Repeating it on a package now that the method is
written down should be considerably cheaper, and this repo exists so that you do not have to pay
that cost again.

## Where the time actually goes

Writing the skills and the tasks is the part you can plan. It is not the part that takes the time.
What takes the time is the loop that follows, where you run the suite and find the skill is less
effective than you expected, and you have to work out why. Expect to spend most of the project here.

In the early stages, we found a skill that
carried most of the questions and then dropped a few, and the aggregate number hid it. Both axes do
this. Efficacy can be solid across a shelf and absent on the one scenario that spans two skills, and
efficiency can go the wrong way on a question the model already knew, where the skill is pure added
cost. Early drafts are especially uneven, which is the argument for reading per-scenario results
rather than the headline. A skill that fails a quarter of the time is not three-quarters finished;
it usually has one or two identifiable holes that resolve the failures, and finding the mismatch between question and skill is the job.

The useful thing is that failures do not all have the same cause, and reading them correctly is an important technique to learn. A task can fail because the skill never got pulled, because it was pulled and did not say
enough, because it said the wrong thing, because the task itself is badly written, or because the
library really is hard to use the way the task asks. Only the middle ones are fixed by editing
prose.

That last category is worth calling out, because we did not expect it. Some tasks failed while the
agent was doing something eminently reasonable. It had a strong intuition about how the library
should work, wrote that, and the library did not work that way. Looking closely, the agent was
right and we were wrong: it was pointing at a design problem. `Markout`'s `TreeNode` put a
rarely-used `badge` argument before the children, so the obvious call did not compile even though
every other shape in the library put the collection where you would expect
([markout#118](https://github.com/richlander/markout/issues/118)). We fixed the API, published, and
scores went up.

To be explicit, because the incentive here is dangerous: **we do not change the product to move
scores.** That would be tuning the library to a benchmark, and the number would stop meaning
anything. The point is the reverse. Running a good eval happens to surface real bugs, in the skills
and sometimes in the library, and when a bug is legitimate you should fix it. The agents need to list to the skill but you also need to listen to what the eval is surfacing.

A model is a useful reviewer here precisely because it has read an enormous amount of code and has
strong, conventional expectations about how an API of a given shape behaves. When your library
violates that expectation, it is telling you something about your design, at a scale and
repeatability no human review gives you.

## How we measure cost: IET

Our measuring stick is **IET**, or Input-Equivalent Tokens: a single cost-equivalent number that
normalizes each token class to fresh-input units:

```
IET = fresh + 0.1·cacheRead + 1.25·cacheWrite + 5·output
```

where `fresh = inputTokens − cacheReadTokens` is Anthropic's **Base Input Tokens** at 1× (the
SDK's `inputTokens` is cache-read-inclusive, verified against every dataset, where cacheRead never
exceeds it). The formula maps 1:1 onto [Anthropic's four billed categories](https://platform.claude.com/docs/en/about-claude/pricing) (Base / cache read /
cache write / output). [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) is similar.

This approach **diverges from the `dotnet/skills` harness
metric**, which reports an unweighted `tokenEstimate = inputTokens + outputTokens` (cache reads
counted at full price, output counted the same as input). We diverged because that estimate
inflates the exploration-heavy raw baseline, so the channel that does the most cheap prompt-cache
reads looks the most expensive, and it undercounts output, which is the dominant real cost.

The
weights are **Anthropic's published pricing multipliers**
([price sheet](https://platform.claude.com/docs/en/about-claude/pricing)): cache read **0.1×**
base input, 5-min cache write **1.25×**, and **output 5×**, uniform and exact across current Claude
models (Opus 4.8 $5→$25, Sonnet $3→$15, Haiku 4.5 $1→$5; see also
[dotnet/sdk#54417](https://github.com/dotnet/sdk/issues/54417)).

A major focus of our effort token arbitrage. There is a 50x differential between cacheRead and output.
Tokens that slide from output to cacheRead enjoy a 50x cheaper accounting. That's a key component of the
efficiency side of our methodology.

Spending cheap cached input to avoid
expensive output is a win the unweighted metric can't see. Cross-channel comparisons then reflect
spend rather than cache-read volume. Tables still cite the harness's raw `tokenEstimate` (`tEst`)
in parentheses for traceability. Full derivation:
[`docs/recommendation.md`](docs/recommendation.md) (Metric) and
[`docs/delivery-and-retrieval.md`](docs/delivery-and-retrieval.md).

## How we measure the lift: the quality card

We want two things from a grounding change: proof it **helps**, and a number we can **trust**. The
hard part is that a coding agent's behavior on a task isn't a bell curve. It can be **multi-modal**. Run
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

**Why 20%, and not simply "an improvement."** Two reasons, and they pull in the same direction.

The first is that the work has to pay for itself. Getting to a defensible claim means authoring the
skill, writing a task suite that genuinely probes the package, and running every task five times per
arm on several models, then doing it again each time the package changes. That is a real, recurring
cost for the maintainer. A win that is technically present but small does not repay it, and the
honest answer in that case is to not ship a skill at all.

The second is that the margin is measured against *today's* models, and it decays. Baselines get
better on their own, which narrows the gap without anyone touching the skill. This is the same
erosion described [above](#what-a-skill-buys-efficacy-and-efficiency), now applied to cost rather
than correctness. An 8% win can be gone entirely inside six months, which makes it a poor thing to
ask users to carry in their context on every task. A 20% floor buys enough headroom that the skill
is still worth having after the next model generation lands. It is a deliberately unfriendly bar,
and most of its value is in what it stops you from shipping.

Two rules keep the card honest. **Never price or time an empty mode:** if an arm never delivers a
task, we do *not* invent a cost or a duration for it. That is a **capability gap** (a coverage row: a
task grounding *unlocks*), counted separately from the efficiency axis, never averaged into it. (This
is why return is scored over all runs but efficiency only over deliveries.) And **only the certified
path is graded**, meaning deterministic verifiable requirements, so the headline numbers don't ride
on judge opinion. The full model, the band procedure, and the claims-to-evidence taxonomy are in
[`docs/quality-card-model.md`](docs/quality-card-model.md) (spec:
[`docs/quality-card-spec.md`](docs/quality-card-spec.md)); a worked four-model result is
[Markout CT-24](https://github.com/richlander/markout/blob/main/grounding/markout/results.md),
presented as a maintainer would see it in [markout#148](https://github.com/richlander/markout/pull/148).

The finding that recurs across model tiers, on every package we have measured: **grounding buys
more as capability falls.** Where the frontier is already near the ceiling, the win is almost
entirely **efficiency** (a delivery gets cheaper and faster). For weaker tiers it is **both**:
grounding unlocks tasks they never delivered, and slashes the cost and time of the ones they did.
Four packages is enough to make this worth testing for on yours, not enough to call it settled.

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
upstream PR. [markout#148](https://github.com/richlander/markout/pull/148) is one that shipped, so
it is the closest thing to a filled-in copy of the
[canonical PR template](docs/templates/canonical-grounding-pr.md).

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
