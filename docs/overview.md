# Package grounding: the concept and the method

Package grounding is package-authored context that teaches a model how to use a specific library
correctly. The delivered artifact is a **`SKILL.md`** skill set — authored to the
[Agent Skills](https://www.anthropic.com/news/skills) convention (YAML frontmatter with a `name` and
a "use when…" `description`, progressive disclosure into supporting files) — that an agent **pulls on
demand** and a consuming repo can remove. The arrangement we settled on, and the one this
document assumes throughout, is a small **base skill** (named for the package) plus a handful of
**domain skills** for its long-tail workflows.

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
decompiled assemblies or the web. Grounding earns its place by making that digging unnecessary.

## What "knowledge" means here

Knowledge here means *resident* model knowledge — not what the model could recover with web search or
tools. Recovering a fact by digging is exactly the cost grounding removes. Grounding only helps where the
model's own knowledge falls short, so the value depends on how *trained* the model is on a given package.

- **Models** are trained on popular packages and progressively less so on niche ones — a decay curve
  that roughly tracks blog-post and Stack-Overflow volume. A **frontier** model's curve decays later
  than a **mini** model's, so the most popular packages are resident for both, but niche packages fall
  out of the mini model first.
- This is why grounding tends to help the **mini** tier most (it fills a real gap) while a **frontier**
  model may already know the answer. The measurement has to respect that asymmetry — a grounding change
  can be a real win for one model and redundant for another.

A second curve runs on time rather than popularity, and it runs in both directions. Time fills the
model in: a package published last month is absent from every model no matter how good it is, and
each later generation knows a little more as public code, posts, and answers accumulate. Time also
invalidates, and that half has a name. **Staleness** is the gap between what the model learned and
what your package is now: features shipped after the training cut are simply missing, and revisions
change behavior out from under code the model still writes from memory. Unlike popularity, neither
direction spares the frontier tier, because no model can know what shipped after it was trained.

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

`System.CommandLine` is a good example; it sat in beta for years, when the initial batch of models
were trained. Soon afterwards, 2.0 was shipped with breaking changes. For a while models
were reliably confused, and a skill correcting them would have been a large efficacy win. That
window has since closed. The efficacy case for a stale-knowledge skill has a half-life set by the
training runs, not by you.

We have seen this pattern in our own numbers, on the packages we have measured so far. Where the
frontier model already sat near the ceiling, its win was almost entirely efficiency: it was already
delivering the task, so the skill only made the delivery cheaper. The weaker tiers gained on both
axes at once, which is the more interesting case: they started delivering tasks they had been
failing outright (efficacy), *and* did the tasks they already managed for far fewer tokens
(efficiency). Read that as a shape to test for rather than a certainty: whether the frontier has
headroom on *your* package depends on how well it already knows it, and on a package it genuinely
does not know it can have a real capability gap too.

We have much less to say about what changes from one model generation to the next. The evidence
there is one package measured on two generations of Opus, which is too little to draw a line from.
The per-package reports in [`docs/reports/`](reports/) carry the detail and the caveats.

The reason the frontier's win lands on one axis and not the other is **resourcefulness**, and it
cuts both ways. An ungrounded agent usually gets there in the end. When it does not know your
package it goes and finds out: it opens the assembly in the NuGet cache, decompiles it, sometimes
writes a throwaway program to reflect over the metadata, and searches the web for whatever is left.
That is genuinely impressive behavior, and it is why a strong model's pass rate barely moves when
you hand it a skill. It already had a way through.

The same trait is what makes the efficiency gap large. Every one of those detours is billed, in
tool calls, in long outputs, and in wall-clock time the developer spends watching. We call the
behavior **archaeology**, because what we mostly see is agents burrowing through the package cache,
and we count it on every run. The extreme case is an agent building a tool it should not have
needed, memorably
[an AI that wrote its own `curl`](https://avelarder.blog/2026/02/25/i-am-a-sad-lobster-now-the-day-an-ai-built-its-own-curl/)
rather than give up. It succeeded. The question for a maintainer is what that success cost, and
whether a few hundred tokens of grounding would have made the dig unnecessary.

This is why the two axes cannot be collapsed into one number. Grade only pass or fail and you will
conclude that grounding does nothing for a strong model, because its resourcefulness absorbs the
gap that grounding would otherwise close. The win is real; it just lands on cost.

Efficiency is a perfectly good target on its own, and it compounds in a way efficacy does not: one
session has many turns, one developer has many sessions, and one company has many developers. A
durable 20% is worth having.

Just be clear that efficiency is the target, and be willing to check rather than assume. The reason
to hold that bar is that a skill is not free. It occupies context and is spent against your users'
token budgets, on every task where the agent pulls it. A skill that merely ties the baseline is a
cost you have handed to them for nothing.

## How a claim is tested

Every claim here is backed by a paired experiment on one fixed harness:

- **baseline** — the agent attempts the task with **no** grounding loaded.
- **grounded** — the same agent attempts the same task with the **`SKILL.md`** grounding available
  to pull.

Each `(task, arm)` is run `k = 5` times, because grounding effects are noisy on any single run, and
across a mini *and* a frontier model — `claude-haiku-4.5`, `claude-sonnet-5`, and
`claude-opus-5` — so the mini-versus-frontier asymmetry shows up directly. We reuse the
[`dotnet/skills`](https://github.com/dotnet/skills) **skill-validator** harness — via a
[fork](https://github.com/richlander/skills/tree/holistic-harness) that carries holistic eval mode —
to run those pairs
and compare accuracy, token usage, and tool calls using pairwise LLM judging.

We record, per run: whether the task was **delivered** (all functional assertions pass *and* it was
done as asked), the **token cost** ([IET](#how-we-measure-cost-iet)), the **wall-clock duration**,
and the **archaeology** it resorted to (cache decompiles, nuget.org fetches, web searches).
Grounding should drive correctness up and archaeology, cost, and time down.

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
[`docs/grounding-eval-methodology.md`](./grounding-eval-methodology.md).

The result is read with the [quality-card model](./quality-card-model.md): the two axes above,
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
right and we were wrong: it was pointing at a design problem.
[Markout](https://github.com/richlander/markout)'s `TreeNode` put a
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

```text
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
[`docs/recommendation.md`](./recommendation.md) (Metric) and
[`docs/delivery-and-retrieval.md`](./delivery-and-retrieval.md).

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
  is the equal-weight mean of those per-task yields, one vote per task (see below).
  Grounding's return lift is the change in yield, baseline → grounded. Because five runs is a noisy
  estimate of a rate, we report it as a **band** (a 95% credible interval) rather than a point, so
  *mode-jumping between runs shows up as reliability*, exactly where it belongs.
- **Efficiency**, the price *and* speed of comparable delivered work. **Per-dollar Total IET on the
  shared set** is the additive economic gate quantity. Beside it, the **levelized per-task geo-mean**
  keeps retry tax and equal task weighting visible as the clean-inference companion. **Per-day**
  duration is the non-gating co-headline. This is where a good skill pays for itself: it stops the
  agent from decompiling the package and web-searching the API.
- **Gate 1, do no harm.** Grounding must not cause a **material regression** on any task (one the
  baseline delivered but the grounded arm doesn't). We calibrate the gate against a null model, so
  normal run-to-run noise can't trip it. Only a real, sustained loss will. The principle is
  [Pareto improvement](https://en.wikipedia.org/wiki/Pareto_efficiency): improve things generally,
  harm no one model in particular. You do not get to choose which model your users bring, and
  routers can switch it mid-task without telling anyone, so a change that lifts the frontier while
  regressing the mini is not a win. Improving efficacy for mini may result in a drop in efficiency
  on frontier, resulting in significant token spend increases on the more expensive model.
- **Gate 2, earn its keep.** The **Total-IET-on-`S` ratio** must clear a **≥20% floor with
  confidence** (the band's upper bound ≤ ×0.80), the minimum premium that repays authoring,
  evaluation, and drift maintenance. The levelized geo-mean remains visible as the typical per-task
  inference companion, but the additive comparable-work total is the business gate. A real-but-tiny
  8% Total-IET win passes *do no harm* yet fails here, and is correctly judged "not worth
  maintaining."

**Why the floor is 20% and not merely positive.** Because the margin is measured against *today's*
models, and it decays. Baselines get better on their own, which narrows the gap without anyone
touching the skill. This is the same erosion described
[above](#what-a-skill-buys-efficacy-and-efficiency), now applied to cost rather than correctness. An
8% win can be gone entirely inside six months, which makes it a poor thing to ask users to carry in
their context on every task. A 20% floor buys enough headroom that the skill is still worth having
after the next model generation lands. It is a deliberately unfriendly bar, and most of its value is
in what it stops you from shipping.

A package lives forever. A model doesn't. Some users may stay on version 1.2.3 for years with your
skill set perfectly captured, unchanged just like it is at its git commit. A meager win now has
real risk on transitioning to loss. A significant win is a buffer won for your users.

Three rules deliver confidence. **The task is the unit of evidence, not the run.** Every task is
run the same number of times, five per arm. What varies is how many of those five *deliver*. The
Total-IET point takes one representative median-Delivered cost per task/arm; the companion levelized
metric charges all-run cost against the `K` delivered units, preserving retry tax.

Never average that pool. A two-task suite shows why. Grounding here does exactly what it should: it
makes both tasks 20% cheaper per delivery, and it drags the hard task from one delivery in five up
to five out of five.

| Task | Baseline cost | Baseline delivered | Grounded cost | Grounded delivered |
| --- | ---: | ---: | ---: | ---: |
| Easy | 10k [IET](#how-we-measure-cost-iet) | 5 of 5 | 8k | 5 of 5 |
| Hard | 100k | 1 of 5 | 80k | 5 of 5 |

Now summarize it two ways.

- **Pool the delivered runs.**
  - Baseline: `(5 × 10k + 1 × 100k) / 6` = **25k**
  - Grounded: `(5 × 8k + 5 × 80k) / 10` = **44k**
  - Verdict: grounding is **76% more expensive**
- **Average the per-task ratios.**
  - Easy: `8k / 10k` = **×0.80**
  - Hard: `80k / 100k` = **×0.80**
  - Verdict: grounding is **20% cheaper**
- **Sum representative delivered costs on the same shared set.**
  - Baseline: `10k + 100k` = **110k**
  - Grounded: `8k + 80k` = **88k**
  - Verdict: grounding is **20% cheaper**

Same runs, same numbers, opposite verdicts. The pooled figure inverts because the grounded arm put
four extra *hard* deliveries into the pool, so the expensive task carries half the grounded average
and only a sixth of the baseline's. Those four deliveries are the whole point of the skill, and
pooling billed them as a loss. (The general name for the reversal is
[Simpson's paradox](https://en.wikipedia.org/wiki/Simpson%27s_paradox).)

So cost is compared on the same tasks both arms delivered. The Total-IET gate sums one representative
delivered cost per task; the geo-mean companion summarizes the levelized per-task multipliers. Both
avoid the invalid delivered-run pool.

One detail the example hides, since two ×0.80s average to ×0.80 whichever way you do it: per-task
ratios are combined with a **geometric mean**, not an arithmetic one. Ratios are multiplicative, and
an arithmetic mean of them depends on which way up you write them. Take a task that gets twice as
cheap (×0.50) alongside one that gets twice as expensive (×2.00), a pair that should cancel exactly.
The arithmetic mean returns ×1.25, calling it a 25% loss. Invert both ratios and it returns ×1.25
again, now calling the baseline 25% worse. Both arms cannot each be 25% worse than the other. The
geometric mean, `√(0.50 × 2.00)`, returns ×1.00 from either direction, and is what the card reports.

**Never price or time an empty mode:** if an arm never delivers a task, we do *not* invent a cost
or a duration for it. That is a **capability gap** (a coverage row: a task grounding *unlocks*),
counted separately from the efficiency axis, never averaged into it. (This is why return is scored
over all runs but efficiency only over deliveries.)

**Only the certified path is graded**, meaning deterministic verifiable requirements, so the
headline numbers don't ride on judge opinion. The full model, the band procedure, and the
claims-to-evidence taxonomy are in
[`docs/quality-card-model.md`](./quality-card-model.md) (spec:
[`docs/quality-card-spec.md`](./quality-card-spec.md)); a worked four-model result is
[Markout CT-24](https://github.com/richlander/markout/blob/main/grounding/markout/results.md),
presented as a maintainer would see it in [markout#148](https://github.com/richlander/markout/pull/148).

The finding that recurs across model tiers, on every package we have measured: **grounding buys
more as capability falls.** Where the frontier is already near the ceiling, the win is almost
entirely **efficiency** (a delivery gets cheaper and faster). For weaker tiers it is **both**:
grounding unlocks tasks they never delivered, and slashes the cost and time of the ones they did.

## Where to go next

- **[getting-started.md](./getting-started.md)** — the workflow end to end, stage by stage, and who
  should drive each stage.
- **[grounding-eval-methodology.md](./grounding-eval-methodology.md)** — the full measurement approach.
- **[quality-card-model.md](./quality-card-model.md)** — how a run becomes a graded, gated decision.
- **[scoring.md](./scoring.md)** — turning a graded run into a reviewable grounding PR.
