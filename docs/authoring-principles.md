# Authoring principles for package skill-set grounding

> **New here?** This doc explains how to author a package's `SKILL.md` skill set: a base skill named
> for the package plus focused domain skills, each using Agent Skills frontmatter and progressive
> disclosure into supporting files. For how we grade and ship grounding, use the ratified
> [quality-card model](./quality-card-model.md): return + efficiency, with do-no-harm and economic
> materiality gates.

Grounding is the technique of installing package-specific skill docs so an agent can stop rediscovering
facts the package can teach directly. The shipped artifact is a **pull-installed skill set**, not an
always-on package doc. A consuming repo opts in, and the skill set is removable.

A package skill set has three layers:

- **Base skill** — named for the package; tells the agent when this package is relevant, carries the
  pattern every task needs, and states the scope the rest of the shelf covers. It does **not** route.
- **Domain skills** — focused `SKILL.md` files for task families, migrations, gotchas, and workflows
  proven to need grounding, each named `<package-slug>-<domain>` and each carrying the setup its own
  examples require, so it works when read alone.
- **Supporting files** — examples, reference notes, fixtures, or checklists loaded by progressive
  disclosure only when a skill needs them.

Every `SKILL.md` uses the Agent Skills convention:

```yaml
---
name: package-slug-domain   # base skill: the package slug alone
description: Use when the task involves the package-specific gap this skill teaches.
---
```

The `description` is the resident discovery hook. The body and supporting files carry the details.

## Naming: derive every skill name from the package id

Skill names live in a **flat, global namespace**. A repeat is a hard error rather than a
degradation — the harness fails the check outright (`CheckDuplicateSkillNames`) — and the format is
1–64 lowercase alphanumeric characters and hyphens.

| Layer | Name | Example |
| --- | --- | --- |
| Base skill | the unit slug: the package id, lowercased and hyphenated | `system-text-json` |
| Domain skill | `<unit-slug>-<domain>` | `system-text-json-source-generation-aot` |

The skill's directory name, its frontmatter `name`, and — for the base skill — `meta.yaml`'s `name`
all carry the same string.

### Why prefix, when the shelf already groups them

Because the shelf is not the boundary that matters. A package skill set is installed into a
consumer's repo *alongside every other package's skill set*, so the names that must not collide are
not the ones inside one shelf. They are the ones across every package the consumer depends on.

`dotnet/skills` carries 98 skills with no collisions, but it gets that for free: one repository, one
gatekeeper, one duplicate check. Package-published skills have **no coordinating authority**.
Nothing stops two maintainers who have never met from both shipping `output-formats` — and fifteen of
the 98 names already there are generic enough that a second author could plausibly pick the same
string (`run-tests`, `filter-syntax`, `property-patterns`, `configure-auth`, `collect-user-input`,
and others).

Deriving the name from the package id dissolves the problem instead of managing it. NuGet already
administers a globally unique id namespace with a real owner, so a derived name **inherits**
uniqueness rather than negotiating it: no registry to build, no allocation step, no central list to
consult before authoring. This is the same trade the ecosystem already accepts in package ids
themselves, where `System.Text.Json.SourceGeneration` is verbose for exactly this reason.

The cost is bounded and small. The longest name this scheme produces in this repo is
`system-text-json-converters-and-polymorphism` — 44 characters against the 64-character cap.

### What this does not solve

Prefixing guarantees **identity** uniqueness. It does nothing to stop an agent selecting the wrong
package's skill for a task; that is a description problem and is orthogonal. Do not treat the
naming rule as protection against mis-selection, and do not let a mis-selection finding argue
against the naming rule.

### Where a residual conflict is caught

The convention binds only the packages that follow it. An installer copying shelves into a consumer
repo must therefore still detect a name it has already seen — and **refuse and report it**, not
rename it.

Renaming at install time is not a safe repair. Where a shelf's domain skills name their base skill
*inside their own `description`* — as the `system-text-json` shelf does today
(``base `system-text-json` skill``) — a renamer would have to rewrite the one field retrieval depends
on, in every sibling. Where they do not, the rename is cheaper but still not free: the directory
name, the frontmatter `name`, and `meta.yaml` have to move together, so the file still
changes. Either way it forks the shelf: the installed copy stops matching the published one, and the
doc content hash — half of the dataset provenance key — no longer identifies what was measured.
Prevention belongs to the author; the installer only reports.

> *A shelf whose skills stand alone lowers this cost but does not remove it. `markout` dropped its
> cross-references in [markout#171](https://github.com/richlander/markout/pull/171) and gave each
> domain skill the setup it had been borrowing, so renaming one no longer breaks its siblings — but
> renaming still rewrites `name`, and the hash still moves.*
>
> *Conformance: the base skills follow this rule today. The domain skills now do too — `markout`
> adopted the prefix in [markout#176](https://github.com/richlander/markout/pull/176), which also
> enforces it at pack time, and the `system-text-json` and `system-commandline` shelves followed in
> dotnet-package-skills#51. The one holdout is `examples/markout/`, a superseded copy of the 0.30.0
> shelf that needs re-syncing rather than renaming. Note that a rename re-hashes a shelf's datasets,
> and that a skill's name is part of what an agent sees when deciding whether to pull it — so figures
> either side of a rename are not strictly comparable.*

## 1. Record only what the model is proven to need

Only include information that an eval has demonstrated the target agent lacks. If a web-blocked baseline
already produces the right result, the fact is model-resident and should not go into the skill set: it
adds retrieval noise, costs tokens, and may create regressions.

Do **not** start from a model-written draft. That contaminates the signal: the draft restates what the
model already knows, masks real gaps, and can inject confident falsehoods. Start from an empty baseline,
run the eval, observe where the agent fails or burns resourcefulness, then add the smallest skill content
that closes the gap. Re-run after every material addition.

### Evidence: System.CommandLine unit

These historical measurements used an earlier score, but the authoring lesson remains durable: keep only
facts that change behavior, especially silent and obscure migration hazards.

| Scenario | Baseline → grounded | Movement | Authoring lesson |
| --- | --- | ---: | --- |
| `AcceptOnlyFromAmong` comparer overload | 5.0 → 5.0 | −2.2% | A well-named current member was already model-resident. |
| Greenfield CLI on 3.x | 5.0 → 5.0 | +1.1% | Current greenfield authoring was already model-resident. |
| Migrate a real 2.0.0-beta4 CLI to 3.x with compile-error gates | 5.0 → 5.0 | +6.4% | Compile errors plus reflection let the baseline recover; value was efficiency-only. |
| Silent break: `new Option<T>("--n", "desc")` changes meaning in 3.x | 5.0 → 5.0 | +9.6% over five runs; guaranteed-context arm +20.6% | A migration that compiles but behaves wrong created real signal, but a single trap was often self-recovered. |
| Same silent break, doc refocused to dense migration/gotcha sections and sharper discovery text | 4.6 → 5.0 | +15.1% over five runs; guaranteed-context arm +22.6% | Better retrieval framing lifted the discover-and-read path from +9.6% to +15.1%; delivery, not fact content, was the bottleneck. |

**Takeaway:** durable signal comes from code transformations the model cannot locally recover: silent
behavioral breaks, obscure version transitions, and package-specific traps. Removed APIs that produce
compiler errors often need less grounding because the normal dev loop exposes the fix.

## 2. Optimize for retrieval, not prose flow

Skill retrieval is section-based and similarity-driven. The agent usually pulls the section or supporting
file most related to its task, not a whole book. Therefore:

- Spend minimum effort on narrative transitions and completeness for its own sake.
- Make each section self-describing and keyword-dense; name old and new identifiers verbatim.
- Put one missing fact or workflow per section when possible.
- Prefer examples that expose the gotcha over broad API tours.
- Stop once the section teaches the gap needed for the quality-card task.

A skill set may read like a set of independent task cards. That is a feature: each card must work when
retrieved alone.

## 3. Write the `description` as a hook, not a synopsis

The frontmatter `description` is paid up front in the resident index. It should make selection obvious,
not reproduce the body.

Include exactly three things:

1. **Identity** — what package or domain this skill covers.
2. **Trigger** — the task shape that should cause the agent to load it.
3. **Differentiator** — the single clue that the model likely lacks this package-local fact.

Do not include full code patterns, exhaustive API lists, or method signatures in the description. Those
belong in the body or supporting files. A sharper discovery hook measurably improved the
System.CommandLine discover-and-read path from +9.6% to +15.1%; longer would not have been better.

### A domain skill must not restate what the base skill already claims

The base skill is the entry point and is read almost every time. A domain skill whose description
repeats the base skill's universal claims will therefore be pulled almost every time too — not because
it fits the task, but because it echoes the thing that always matches.

Measured on the System.CommandLine CT-24 suite (haiku, 24 scenarios × 5 runs). `actions-and-invocation`
opened its description with `SetAction` and "reading values with parseResult.GetValue" — both already
claimed by the base skill's "Covers the core shapes: declaring inputs, building the command tree,
SetAction, and reading values by identity". Retrieval precision, counting a pull as correct when the
skill is the scenario's expected family:

| Skill | Scenarios pulled into | Precision | Family pass rate |
| --- | --- | --- | --- |
| `net-3x-additions` | 1 / 24 | 100% | 80.0% |
| `subcommands-and-help` | 4 / 24 | 75% | 60.0% |
| `beta-to-ga-migration` | 4 / 24 | 50% | 100.0% |
| `options-and-arguments` | 11 / 24 | 45% | 28.0% |
| `actions-and-invocation` | 13 / 24 | **15%** | **10.0%** |

Precision tracks the outcome: the skill pulled into more than half the suite while being the right
answer twice was also the worst-scoring family. Being read is not the same as being useful, and a
description that over-attracts costs the run the skill it should have read instead.

The same trap applies to any cross-cutting mechanism. Naming a bare "exit codes" attracts every
scenario that mentions a non-zero exit, whatever the scenario is actually about; scoping it to the
decision the skill owns — choosing the process exit code from what an action returns — does not.

State what is distinctive about the skill, and let the base skill keep the shapes common to the whole
package.

Confirmed by re-running the suite after rewriting that one description to drop the base skill's
claims. Nothing else about the skill changed, and the baseline arm was reused rather than re-run, so
the control is identical:

| | Before | After |
| --- | --- | --- |
| `actions-and-invocation` scenarios pulled into | 13 / 24 | **4 / 24** |
| `options-and-arguments` scenarios pulled into | 11 / 24 | 14 / 24 |

The over-attraction collapsed, and the pulls moved to the skill that owned the material.

### A worked example beats a correct mention

An API that appears in a skill can still be unreachable. Two scenarios in the same family failed for
this reason, both while the agent was demonstrably reading the skill that documented the API.

`C16` needs a rule spanning two options. The skill showed a validator on a single option under the
comment "Cross-cutting/range validation" — accurate about the API, wrong about the shape, and an
option-level validator cannot see another option's value. `C11` needs an option supplied twice. The
skill said `Option<T[]>` / `Option<List<T>>` "collect multiple values" at the tail of a bullet about
`Arity`, with no example and no command line.

Replacing each with a worked example — the declaration, plus the command line it accepts:

| Scenario | Before | After |
| --- | --- | --- |
| C16 cross-cutting validator | 0 / 5 (twice) | **4 / 5** |
| C11 option supplied twice | 2 / 5 | 3 / 5 |

C16 had failed every run across two earlier attempts, both of which misread it as a retrieval problem
because the skill did mention validators. Coverage was never the deficit; a usable example was. Write
the example with the input it accepts, not the API name.

## 4. Keep claims first-party and package-local

A package skill set may speak with authority only about its own surface: overload choices, version
transitions, serialization behavior, supported constraints, package-owned diagnostics, and package-owned
examples. It should not assert broad multi-component architecture guidance unless that guidance is owned
and tested by this package's maintainers.

This keeps the blast radius small. Package-local truth is reviewable by package owners; cross-stack prose
quickly becomes speculative and hard to grade. If a section teaches a workflow spanning multiple packages,
make it a domain skill only when the eval, tests, and ownership all cover the full workflow.

## 5. Keep the README human and the skill set agentic

A README is still for humans: narrative ramp, onboarding, marketing, concepts, and progressive examples.
A package skill set is for agents: measured gaps, independently retrievable sections, and supporting files
loaded on demand.

Do not make the README token-optimized, and do not make the skill set a prose rewrite of the README. The
right authoring order is:

1. Run the baseline with no skill set.
2. Add the smallest skill content that closes observed gaps.
3. Use the resulting gap list to check whether the README also teaches humans the necessary facts.
4. Fix README omissions in human prose, not as a substitute for the skill set.

## 6. Keep each skill tight and use progressive disclosure

Retrieval quality falls when sections bloat, so keep the base skill short. Cut model-resident basics
first. Move lengthy examples, matrices, and deep references into domain skills on the shelf that the
agent pulls only when the task calls for them.

## 7. Make each skill work on its own; never claim the shelf is complete

Our shelves were built on a **hub** model: the base skill carried a "Which skill for what" routing
table and the domain skills borrowed their setup from it. Measured on markout's CT-24 (26 scenarios,
haiku, 130 plugin-arm runs per variant, one pinned baseline —
[markout#171](https://github.com/richlander/markout/pull/171)), that model does not earn its keep.

| CT-24, 130 runs per variant | hub (routing table) | standalone, base claims completeness | **standalone, base states scope** |
| --- | --- | --- | --- |
| overall pass | 84.6% | 78.5% | **87.7%** |
| runs that read a domain skill and no base skill | 0 | 21 (95.2% pass) | **36 (91.7% pass)** |
| domain-task runs stuck on the base skill alone | 1/100 | 25/100 | 8/100 |

Three things follow.

**Routing is causal, and it is a cost.** Removing the table moved base-skill reads from 85.4% to
71.5% (p=0.007) and took domain-without-base from 0% to 16.2% (p<0.0001). The near-total base pull we
had been reading as a genuine dependency was substantially an artifact of the pointer. A shelf that
routes will always look like a shelf whose base skill is indispensable, because it made itself so.

**A skill read alone outperforms the shelf average.** Runs that opened a domain skill with no base
skill present passed 91.7–95.2% — the best bucket in the experiment. This is the direct payoff for
giving each domain skill the setup it had been borrowing (for markout, the partial
`MarkoutSerializerContext` every example needs). It also makes the shelf **subset-installable**: an
installer can copy one skill without silently breaking it, and the rename cost drops.

**The dangerous sentence is the completeness claim, not the missing pointer.** The middle column
regressed because dropping the table left the base skill asserting that *everything you need is
here*. That is false on a domain task and it **terminates the search** — 25 runs never opened another
file. Restoring honest scope ("output formats and conditional composition are covered separately")
recovered it. Note what did *not* happen: base-only runs did not get better (50% vs 48%); they got
**rarer** (25→8). One sentence controls whether the agent keeps looking.

So: name the topics, never the skill directories — a directory name is a pointer that dangles under
subset install, and a topic name is a claim about scope that stays true.

Be honest about the residual. A scope statement is a **weaker dispatcher than a router by design**,
because it deliberately does not instruct: 8 runs still stalled against the hub's 1 (p=0.017). That
cost does not reach overall pass rate at n=130 (+3.1 pts vs hub is *not* significant), so the trade
is "same correctness, no lock-in" rather than a clean win. And this is **one model on one package**;
the whole effect traces to a single sentence, so model-dependence is plausible. Re-measure before
retiring routing from a shelf you have not tested.

## 8. Target silent, obscure, non-self-correcting gaps

Cross-package probes show that a gotcha must usually satisfy all three conditions to move strong agents:

| Property | SCL alias-vs-description | STJ case-insensitivity | STJ Native AOT source generation | M.E.AI function invocation |
| --- | --- | --- | --- | --- |
| Silent | Yes | Yes | No; it throws | Yes; empty output |
| Obscure | Yes | No; famous | Yes; post-training | No; common examples teach it |
| Result | +15.1% | +0.0 pts | +0.0 pts | −1.0% |

Both STJ cells were re-measured on the rebuilt suite; the superseded figures and why they were wrong
are below.

### Evidence: System.Text.Json unit

Measured on the rebuilt 24-scenario CT-24 suite (hint-free, goal-stated, assertions verified 48/48
positive and 7/7 against negative controls), `claude-haiku-4.5`, 5 runs per scenario, 120 runs per
arm. Whole suite: **77.5% → 86.7%, +9.2 pts.**

| Scenario family | Baseline → grounded | Movement | Authoring lesson |
| --- | --- | ---: | --- |
| Migrate Newtonsoft.Json code; silent break is case-sensitive matching by default (3 scenarios) | 100% → 100% | +0.0 pts | The baseline gets it right in every run unaided. The gotcha really is too famous. |
| Make reflection serialization Native AOT compatible with source generation (3 scenarios) | 100% → 100% | +0.0 pts | The break is real but loud: the exception names source generation, so the baseline self-corrects. |
| Reject duplicate keys / unmapped members at a trust boundary (2 scenarios) | 30% → 70% | **+40.0 pts** | Silent, obscure and post-training — all three conditions hold, and this is where the shelf pays. |

The third row is the one that carries the principle. It is the only STJ family where the failure is
silent *and* the API postdates the model's training, and it moves four times the whole-suite average.
Where either condition fails, grounding buys nothing.

#### Superseded figures

The same two families were previously reported as **−12.5%** and **+7.9%**. Those came from the
pre-rebuild suite, which leaked: 47 of its 48 fixtures carried a `// Hint:` line in `Program.cs`
naming the exact API under test, and 30 of 48 prompts named it too. A skill-less baseline passes such
a scenario by transcription, which **inflates the baseline and suppresses measured uplift** — exactly
the shape of a small or negative movement.

The re-measurement lands at +0.0 for both, so the conclusions in the last column survive; it was the
magnitudes, and the apparent *negative*, that were artifacts. The SCL and M.E.AI rows come from
different suites and were never affected.

### Evidence: System.CommandLine unit, rebuilt suite

Same protocol, on the rebuilt 24-scenario SCL suite against `3.0.0-preview.6.26359.118`. Whole suite:
**11.7% → 65.0%, +53.3 pts** — the largest effect measured anywhere in this repo, and the cleanest
illustration of the principle.

| Scenario family | Baseline → grounded | Movement |
| --- | --- | ---: |
| Subcommands and help customization (5 scenarios) | 0% → 76% | **+76.0 pts** |
| 3.x-only additions (3 scenarios) | 6.7% → 80% | **+73.3 pts** |
| Base skill scenarios (7) | 17.1% → 82.9% | +65.7 pts |
| beta→GA migration (2 scenarios) | 50% → 100% | +50.0 pts |
| Actions and invocation (2 scenarios) | 0% → 30% | +30.0 pts |
| Options and arguments (5 scenarios) | 8% → 20% | +12.0 pts |

The baseline does not merely underperform here — it scores **0%** on two families. The failures are
not subtle judgement calls: the ungrounded arm writes the 2.0-beta4 API it was trained on and misses
`SetAction`, `DefaultValueFactory` and `Required = true`, which the code greps catch directly. Every
one of the three conditions holds at once, and this is what that looks like.

The contrast with STJ is the useful part. Both suites were built the same way by the same author with
the same rigour; the difference in outcome is a property of **the libraries**, not of the writing. A
mainstream BCL type the model has seen a decade of examples of yields +9.2; a preview API that
postdates training yields +53.3. Content quality is not the variable that separates them.

`options-and-arguments` was the outlier: grounded reached only 20%, so the shelf was not carrying that
family. Four changes to that one family — two to descriptions, two replacing a mention with a worked
example — took it to **36%**, and the suite to **6.7% → 64.2%, +57.5 pts**, the largest uplift recorded
here. The baseline arm was reused across the last two runs rather than re-measured, so that movement is
attributable to the shelf and not to run-to-run drift.

Worth recording how that was found, because two of the three diagnoses were wrong. The family was
first read as a retrieval problem, since the failing scenarios were not opening the skill that held
the answer. Fixing retrieval did move the scenarios that were genuinely mis-routed, but the worst
scenario kept failing every run — and once it was demonstrably reading the right skill, the remaining
explanation was that the skill did not answer it. It did not: the API was named but never shown in the
shape the task needed. **A skill that mentions the right API looks like a content-complete skill, and
a retrieval metric cannot tell you otherwise.** Check whether the failing runs read the skill before
concluding anything about why they failed.

### Evidence: Microsoft.Extensions.AI unit

| Scenario | Baseline → grounded | Movement | Authoring lesson |
| --- | --- | ---: | --- |
| Wire up tool calling; missing `.UseFunctionInvocation()` means tools are never invoked | 5.0 → 5.0 | −1.0%; CI [−1.6%, −1.0%] | The strong baseline diagnosed and fixed the missing wrapper in every run; common examples made it resident. |

A silent break is necessary but not sufficient. It must also be obscure and not self-correcting at compile
or run time.

## 9. Grounding is model-relative

The same content can be redundant for a frontier model and decisive for a cheaper model. In the
Microsoft.Extensions.AI function-invocation scenario, changing only the agent model flipped the result:

| Agent model; judge held constant | Movement | Baseline quality | Baseline cost |
| --- | ---: | --- | --- |
| Opus 4.6 | −1.0% | 5.0/5 | 66k tokens / 7 tools / 26s |
| Haiku 4.5 | +63.3%; CI [+39.7%, +74.0%] | 1.6/5 → grounded 5.0 | 281k tokens / 20 tools / 73s → grounded 87k / 7 / 29s |

The Haiku baseline sensed the bug but chose a hand-written tool loop, hit compile errors, and never
produced a working app. With grounding it added `.UseFunctionInvocation()`, built, ran, and finished in
7 tool calls. A cheap closed-book pre-probe predicted this: Haiku declined to guess the gotcha, while the
frontier model knew it.

Author with the strongest available model, but measure the fleet that will use the skill set. This is
knowledge distillation: serialize frontier-resident package facts for weaker agents without harming the
strong tier.

## 10. Harden discovery against circularity

Discovery and measurement can become circular when candidate gaps come from the same model family being
measured. Countermeasures:

- Observe failures from a zero-grounding baseline; that is the strongest gap signal.
- Prefer genuinely post-cutoff material: release notes, new APIs, renamed members, package tests, and
  newly introduced constraints.
- Run a cheap residency pre-probe before a full eval; if the bare model names the gotcha, skip or retarget.
- Let models suggest tasks, but have humans validate task coverage, prompt fairness, and assertions.
- Test weaker deployed agents as well as frontier agents.

## 11. Measure with the quality card

Older score weights overemphasized judge quality and underweighted efficiency. Grounding often wins by
preventing flailing: fewer tool calls, fewer output tokens, and less local package archaeology. The
quality-card model fixes the measurement target:

- **RETURN** — graded yield on `Fails < Satisfies < Delivers`, plus reliability `ΔP` on the shared-success
  set.
- **EFFICIENCY** — Total IET on the shared set gates; the levelized geo-mean is the inference
  companion, and duration per day is a co-headline.
- **Ship gate 1: do no harm** — loss mass must clear the null-95 baseline.
- **Ship gate 2: economic materiality** — the Total-IET ratio credible-interval upper bound must be at
  most `×0.80`, an aggregate cost cut of at least 20% on comparable delivered work.

A skill-set edit is a claim. Ship the claim only with the card and evidence that support it.

## Practical checklist

- Keep only lines tied to observed failures, resourcefulness, or cost reductions.
- Prefer migration and transformation tasks over greenfield usage when probing for gaps.
- Use the `description` as a selection hook.
- Split broad content into base and domain skills with supporting files.
- Give each domain skill the setup its own examples need, and let the base skill state scope rather
  than route.
- Never let a skill claim the shelf is complete.
- Stay first-party and package-local.
- Re-run the grounded-vs-baseline eval after material edits.
