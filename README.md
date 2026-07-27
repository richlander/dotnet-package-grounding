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

## What the methodology does

A skill can buy two different things, and they age differently. **Efficacy** is the agent producing
a correct result where it previously failed. **Efficiency** is reaching the same correct result for
fewer tokens, fewer tool calls, and less wall-clock time. Efficacy erodes as models learn your
package; efficiency usually survives, and it compounds, because one session has many turns and one
company has many developers.

Every claim is a paired experiment. The same agent attempts each task once without the skill and
once with it, five runs per arm, across a mini *and* a frontier model. The tasks come from a fixed
per-package suite, **CT-24**, derived from how the library is used in real applications rather than
from its API surface, because invented tasks tend to exercise the library the way its own
documentation already does, and both arms do well. Results are read with the
[quality-card model](docs/quality-card-model.md): two axes, return and efficiency, behind two ship
gates, do no harm plus a certified 20% economic win.

The finding that recurs on every package we have measured: **grounding buys more as capability
falls.** Where the frontier model is already near the ceiling, the win is almost entirely
efficiency. For the weaker tiers it is both at once, unlocking tasks they never delivered and
cutting the cost of the ones they did.

## Four ways a skill arrives

A `SKILL.md` can arrive in four ways. The first three are established and fully supported today.
The fourth is what this repo is about, and the useful thing about it is that it is **not a fourth
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
Markout's [`skills/`](https://github.com/richlander/markout/tree/main/skills) is the worked example
of the vehicle.

And once installed, row 4 **collapses into row 3**, into the same directory a hand-written project
skill would occupy. The skills land in the consumer's repo as checked-in files they can read,
review, diff, and delete. That is the recommended persistence pattern, and it is what keeps the cost
of package skills near zero: no new runtime, no new trust boundary, nothing to support beyond files
in a repository.

The step that is still missing is the installer itself, the part that notices a restored package
ships a shelf and puts it in the consumer's repo. That is tracked in
[#21](https://github.com/richlander/dotnet-package-skills/issues/21). Everything below is about
row 4.

## Where to go next

- **[`docs/overview.md`](docs/overview.md)** covers the concept and the method end to end, and is
  the right place to start.
- **[`docs/getting-started.md`](docs/getting-started.md)** builds the CLI, authors a skill, runs
  the ladder, and reads the card.
- **[`docs/harness.md`](docs/harness.md)** is the harness mechanics.
- **[`docs/delivery-and-retrieval.md`](docs/delivery-and-retrieval.md)** covers how grounding
  physically reaches the agent, which turns out to matter as much as what it says.
- **[`docs/grounding-eval-methodology.md`](docs/grounding-eval-methodology.md)** is the full
  evaluation approach, terms, threshold gate, and evidence dump.
- **[`docs/recommendation.md`](docs/recommendation.md)** is the executive summary of what we found.
- **[`docs/`](docs/)** indexes the rest, including the per-package reports.
