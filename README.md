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

[Package grounding — the concept in one pass](docs/overview.md) covers the concept in one pass.
The harness mechanics live in [`docs/harness.md`](docs/harness.md); this page is about the concept
and the findings. How grounding physically reaches the agent, which turns out to matter as much as
what it says, is [`docs/delivery-and-retrieval.md`](docs/delivery-and-retrieval.md). How we
evaluate a change and decide whether it ships, including the methodology, terms, threshold gate,
and evidence dump, is the
[grounding eval methodology](docs/grounding-eval-methodology.md).

## Package skills

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
per-package reports in [`docs/reports/`](docs/reports/) carry the detail and the caveats.

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
  is the equal-weight mean of those per-task yields, one vote per task (see below).
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
  regressing the mini is not a win. Improving efficacy for mini may result in a drop in efficiency
  on frontier, resulting in significant token spend increases on the more expensive model.
- **Gate 2, earn its keep.** The per-dollar win must clear a **≥20% floor with confidence** (the
  band's upper bound ≤ ×0.80), the minimum premium that repays a real recurring cost: authoring the
  skill, writing a suite that genuinely probes the package, running every task five times per arm
  on several models, and doing it again each time the package changes. This is the number a
  semiconductor CEO would put on an earnings slide: a committed margin, not a curve. A real-but-tiny
  8% win passes *do no harm* yet fails here, and is correctly judged "not worth maintaining."

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
run the same number of times, five per arm. What varies is how many of those five *deliver*, and
price is only charged on deliveries. An arm that nails a task five times out of five puts five
priced runs into the pool; an arm that squeaks out one delivery puts in one.

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

Same runs, same numbers, opposite verdicts. The pooled figure inverts because the grounded arm put
four extra *hard* deliveries into the pool, so the expensive task carries half the grounded average
and only a sixth of the baseline's. Those four deliveries are the whole point of the skill, and
pooling billed them as a loss. (The general name for the reversal is
[Simpson's paradox](https://en.wikipedia.org/wiki/Simpson%27s_paradox).)

So cost is compared per task, on the tasks both arms delivered, which keeps both averages over the
same set of tasks.

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
[`docs/quality-card-model.md`](docs/quality-card-model.md) (spec:
[`docs/quality-card-spec.md`](docs/quality-card-spec.md)); a worked four-model result is
[Markout CT-24](https://github.com/richlander/markout/blob/main/grounding/markout/results.md),
presented as a maintainer would see it in [markout#148](https://github.com/richlander/markout/pull/148).

The finding that recurs across model tiers, on every package we have measured: **grounding buys
more as capability falls.** Where the frontier is already near the ceiling, the win is almost
entirely **efficiency** (a delivery gets cheaper and faster). For weaker tiers it is **both**:
grounding unlocks tasks they never delivered, and slashes the cost and time of the ones they did.

## Three ways a skill arrives

A `SKILL.md` can arrive in four ways. Three of them are established and fully supported today. The
fourth is what this repo is about, and the useful thing about it is that it is **not a fourth
mechanism**.

These definitions are up for debate and may differ by domain or community. We define them a
particular way here for the purposes of measurement and guidance for the package-grounding
feature.

| | Delivery vehicle | Installed location | Who gets it |
| --- | --- | --- | --- |
| **1. Marketplace skill** | `plugins/<plugin>/skills/<name>/` in a marketplace repo | `~/.copilot/installed-plugins/.../<name>/` | one developer, in every project |
| **2. Per-user skill** | authored in place | `~/.copilot/skills/<name>/` | one developer, in every project |
| **3. In-repo skill** | authored in place | `.github/skills/<name>/` | every developer in one repo |
| **4. Package skill** | `skills/<name>/` in the `.nupkg` | `.github/skills/<name>/` | every developer in one repo |

Each `<name>/` directory holds a `SKILL.md` plus whatever it discloses into. The paths above are
Copilot CLI's, which
[documents](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
`.github/skills/`, `.claude/skills/` and `.agents/skills/` for a repo, and `~/.copilot/skills/` or
`~/.agents/skills/` for a user. Claude Code reads the `.claude` pair, which is why a skill written
once tends to work in both. Row 1 is the exception: each host manages its own marketplace cache,
under its own path.

Rows 2 and 3 are authored where they are used. Rows 1 and 4 travel, which is the only reason either
needs an installer. [dotnet/skills](https://github.com/dotnet/skills/tree/main/plugins) is the
reference layout for row 1: a `.claude-plugin/marketplace.json` at the root over a tree of plugins.
Row 4's vehicle is the package itself, since that is the artifact the consumer actually receives;
the repo it was authored in is upstream of the question. What is unsettled is acquisition, which is
what [#21](https://github.com/richlander/dotnet-package-skills/issues/21) tracks: a skill whose job
is installing skills. The interesting part is that it need not install all of them. A package can
ship a dozen skills covering features a given repo will never touch, and an agent that has just
read that repo is better placed to pick the relevant subset than the package author was.

**The last column is the one that matters.** Rows 1 and 2 install per machine, which is the right
scope for a developer's own preferences and the wrong scope for a dependency. A skill only one
teammate has installed makes that person's results irreproducible for everyone else, and it is
invisible in review, so nobody can tell whether an odd suggestion came from the model or from
something in a home directory. Worse, the version is chosen by whoever installed it rather than by
the repo that depends on the package, so two contributors sitting on the same commit can be running
different guidance against the same code. A dependency is a property of the repository, and its
skills should be too. That is why package skills target row 3.

Row 4 is an alternative **distribution channel for row 1**, not a new kind of thing. The user
already fetched your package, so the skill can ride along with a dependency they chose, instead of
being something they have to know exists and go find in a marketplace. That is the entire pitch:
discovery is the hard part of row 1, and a package they already depend on solves it.
[Markout](https://github.com/richlander/markout/tree/main/skills) is the worked example of the
vehicle.

And once installed, row 4 **collapses into row 3**, into the same directory a hand-written project
skill would occupy. The skills land in the consumer's repo as checked-in files they can read,
review, diff, and delete. That is the recommended persistence pattern, and it is what keeps the cost
of package skills near zero: no new runtime, no new trust boundary, nothing to support beyond files
in a repository.

The step that is still missing is the installer itself, the part that notices a restored package
ships a shelf and puts it in the consumer's repo. That is tracked in
[#21](https://github.com/richlander/dotnet-package-skills/issues/21). Everything below is about
row 4.
