# dotnet-package-skills

This repo is about *skill grounding*: targeted instructions that are included in a package so that
an AI coding agent uses it correctly. As a package maintainer, you know the broad spread of user
scenarios, from the basics to the advanced. Writing those scenarios as skills can give your users a
better experience when they ask agents to use your package.

The repo exists because we tried to do that, as package maintainers, and found that writing good
skills with any confidence in their utility is very difficult without a measurement methodology.
The primary product of the effort is that methodology and the tools around it, shared so the
process is easier for the next maintainer: what to write, what to leave out, and how to validate
it, with worked examples for real packages.

**[Package grounding: the concept and the method](docs/overview.md)** is the long-form read: why
grounding helps, what a skill buys, how a claim is tested, and how we decide whether one ships.
This page is the short version and the map.

## Package skills

Grounding is delivered as a **skill set**, or shelf. The shape we settled on is a **base skill**
named after the package, holding what every task needs plus its everyday footguns, and a handful of
**domain skills** covering long-tail workflows that the agent pulls only when a task calls for them.
Nothing about the format requires that arrangement. We arrived at it by trying alternatives and
measuring, and it has held up on every package since: the base skill earns its place on almost any
task, and leaving the rest out of context until a task calls for it is what keeps the shelf from
becoming a tax on the tasks that never needed it.

[Markout](https://github.com/richlander/markout) is the package we have measured most, and its
shelf is the worked example: a `markout` base skill plus `conditional-composition`,
`output-formats`, `built-in-shapes`, and `composite-cells-cards`
([skills/](https://github.com/richlander/markout/tree/main/skills)).

The files follow [Anthropic's Agent Skills](https://www.anthropic.com/news/skills) convention: a
`SKILL.md` with YAML frontmatter (a `name` and a "use when…" `description`) that points to
supporting files the agent reads only when a task calls for them. Any Skills-aware agent host can
load them.

The approach heavily leverages agents, based on a set of best practices. These are examples, and
both halves are based on experience: the ineffective half is mostly what we tried first, before the
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

## What the methodology does

A skill can buy two different things, and they age differently. **Return** is the agent producing
work that passes the full `Fails < Satisfies < Delivers` ladder, including the requested API or
approach rather than merely a workable substitute. **Efficiency** is delivering the same work for
less token cost and less wall-clock time. Return gains erode as models learn your package;
efficiency usually survives, and it compounds, because one session has many turns and one company
has many developers.

Every claim is a paired experiment. The same agent attempts each task without the skill and with it,
five runs per arm, across weaker and frontier models. The tasks come from a fixed per-package suite
of 24 graded tasks we call **CT-24**, for *complete textbook*: the questions a library's
documentation ought to be able to answer, ordered from what you need on day 1 to the niche corner
you hit on day 100. They are derived from how the library is used in real applications rather than
from its API surface, because invented tasks tend to exercise the library the way its own
documentation already does, and both arms do well.

The [quality-card model](docs/quality-card-model.md) reads those runs on two axes:

- **Return:** graded yield plus reliability. A `4/5` or `6/7` result is evidence of a reliability
  problem, not proof that the capability is absent.
- **Efficiency, per dollar:** [Input Equivalent Tokens (IET)](docs/iet-model.md) prices cached input,
  fresh input, and output in one machine-independent unit. The economic gate uses **Total IET on the
  shared set**: one representative Delivered cost for every task both arms delivered, summed for
  each arm. Its ratio answers the business question, *what did the same workload cost?*
- **Efficiency, per day:** delivered wall-clock duration is reported beside cost. It answers *how
  quickly did the same work arrive?* but does not gate because it depends on the host.
- **Inference companion:** the levelized per-task IET geo-mean remains visible. It charges retry cost
  and answers *what was the typical task multiplier?* The additive total and typical multiplier
  answer different questions and are never summed into one score.

A skill ships only when both gates clear:

1. **Do no harm:** grounding must not create loss beyond the run-to-run noise expected under the
   null.
2. **Earn its keep:** the 95% interval upper bound of the Total-IET ratio must be `≤ ×0.80`, a
   certified reduction of at least 20% on comparable delivered work. A real but small win does not
   repay authoring and maintenance. A thin shared set cannot certify the gate.

We have tested the methodology on several packages and found uniformly that **grounding buys more
as capability falls**. Where the frontier model already sits near the ceiling, the win is almost
entirely efficiency: it was delivering the task anyway, so the skill only made the delivery
cheaper. The weaker tiers gain on both axes at once, delivering tasks they had been failing
outright and doing the rest for far fewer tokens.

## Four ways a skill arrives

A `SKILL.md` can arrive in four ways. The first three are established and fully supported today.
The fourth is what this repo is about. It is best read as a **new delivery vehicle feeding an
existing consumption pathway**: the package is what carries the skill, but what the agent ends up
loading is an ordinary in-repo skill, in the ordinary place.

These definitions are up for debate and may differ by domain or community. We define them a
particular way here for the purposes of measurement and guidance for the package-grounding
feature.

| | Delivery vehicle | Installed location | Who gets it |
| --- | --- | --- | --- |
| **1. Marketplace skill** | `plugins/<plugin>/skills/<name>/` in a marketplace repo | `~/.copilot/installed-plugins/.../<name>/` | one developer, in every project |
| **2. Per-user skill** | authored in place | `~/.copilot/skills/<name>/` | one developer, in every project |
| **3. In-repo skill** | authored in place | `.github/skills/<name>/` | every developer in one repo |
| **4. Package skill** | `skills/<name>/` in the `.nupkg` | `.github/skills/<name>/` | every developer in one repo |

Each `<name>/` directory holds a `SKILL.md` and any supporting files it references. The paths
above are Copilot CLI's, which
[documents](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
`.github/skills/`, `.claude/skills/` and `.agents/skills/` for a repo, and `~/.copilot/skills/` or
`~/.agents/skills/` for a user. Claude Code reads the `.claude` pair, which is why a skill written
once tends to work in both.

Rows 2 and 3 are authored where they are used. Rows 1 and 4 travel, which is the only reason either
needs an installer.

Row 1 is a formal skill distribution channel, roughly similar to publishing a container image to
Docker Hub for others to use. Users subscribe to a marketplace (like
[dotnet/skills](https://github.com/dotnet/skills)) and a plugin (like
[dotnet-advanced](https://github.com/dotnet/skills/tree/main/plugins/dotnet-advanced)). The
`marketplace.json` it exposes is the catalog those plugins are downloaded, installed, and updated
from.

Row 4's vehicle is the package itself, and its `marketplace.json` is the consumer's `app.csproj`.
The dependencies they already chose are the catalog.

Row 4 is an alternative **distribution channel for row 1**. The user already fetched your package,
so the skill can ride along with a dependency they chose, instead of being something they have to
know exists and go find in a marketplace. That is the entire pitch: discovery is the hard part of
row 1, and a package they already depend on solves it. Markout's
[`skills/`](https://github.com/richlander/markout/tree/main/skills) is the worked example of the
vehicle: the shelf ships from the repo root, and the eval that grades it sits apart in
[`grounding/`](https://github.com/richlander/markout/tree/main/grounding).

And once installed, row 4 **collapses into row 3**, into the same directory a hand-written repo
skill would occupy. The skills land in the consumer's repo as checked-in files they can read,
review, diff, and delete. That is the recommended persistence pattern, and it is what keeps the cost
of package skills near zero: no new runtime, no new trust boundary, nothing to support beyond files
in a repository.

The step that is still missing is the installer itself, the part that notices a restored package
ships a shelf and puts it in the consumer's repo. That is tracked in
[#21](https://github.com/richlander/dotnet-package-skills/issues/21). We intend to offer a skill
whose job is installing package skills. The interesting part is that a "package skill agent" need
not install all package skills. A package can ship a dozen skills covering features a given repo
will never touch, and an agent that has just read that repo is better placed to pick the relevant
subset than the package author was.

**The last column defines scoping and consistency**, which is what matters in a team environment.
Rows 1 and 2 install per machine, which is the right scope for a developer's own preferences and the
wrong scope for a dependency. A skill only one teammate has installed makes that person's results
irreproducible for everyone else, and it is invisible in review, so nobody can tell whether an odd
suggestion came from the model or from something in a home directory. Worse, the version is chosen
by whoever installed it rather than by the repo that depends on the package, so two contributors
sitting on the same commit can be running different guidance against the same code. A dependency is
a property of the repository, and its skills should be too. That is why package skills target row 3.

## Where to go next

- **[`docs/overview.md`](docs/overview.md)** covers the concept and the method end to end, and is
  the right place to start.
- **[`docs/getting-started.md`](docs/getting-started.md)** maps the workflow stage by stage and
  says which stages an agent can drive.
- **[`docs/harness.md`](docs/harness.md)** is the harness mechanics.
- **[`docs/delivery-and-retrieval.md`](docs/delivery-and-retrieval.md)** covers how grounding
  physically reaches the agent, which turns out to matter as much as what it says.
- **[`docs/grounding-eval-methodology.md`](docs/grounding-eval-methodology.md)** is the full
  evaluation approach, terms, threshold gate, and evidence dump.
- **[`docs/recommendation.md`](docs/recommendation.md)** is the executive summary of what we found.
- **[`docs/`](docs/)** indexes the rest, including the per-package reports.
