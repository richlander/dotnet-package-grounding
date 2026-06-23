# Standard: eval-based grounding content PRs

How the team proposes and reviews a change to package **grounding content** (an `AGENTS.md` that
ships in a package root). The rule is simple: **grounding changes are claims, and a claim ships with
its evidence.** A PR that edits `AGENTS.md` without a reproducible eval behind it is not reviewable.

This mirrors the rigor we now hold ordinary code PRs to — see
[dotnet-inspect#1209](https://github.com/richlander/dotnet-inspect/pull/1209) for the shape we are
matching (a *Changes* summary, a `Baseline | PR | Delta` metrics table, a representative check, and an
explicit *Validation* block of reproducible commands). It adapts that shape to grounding evals, where
the "delta" is **baseline (ungrounded) vs grounded** rather than before/after a code fix. External
context for the broader grounding effort:
[aspire#18437 (comment)](https://github.com/microsoft/aspire/pull/18437#issuecomment-4782880736).

---

## 1. What a grounding PR contains

A grounding content PR is **not** just the `AGENTS.md` diff. It carries its own proof:

| Artifact | Path | Why |
| --- | --- | --- |
| The grounding edit | `grounding/<unit>/AGENTS.md` | The change itself. Body ≤ the line limit (`eng/agents-line-limit.txt`, currently 60). |
| The regenerated wrapper | `grounding/<unit>/SKILL.md` | Generated from `AGENTS.md` by `eng/sync-skill.sh`; must be in sync (`--check` passes). |
| The dataset | `data/<unit>-6q/<unit>.n3.haiku.json` | The matched n≥3 results the table is computed from. Commit it. |
| The report | `docs/reports/<unit>.md` | The narrative: what the agent gets wrong unaided, what the grounding fixes, the numbers, the caveats. |

`AGENTS.md` is the source of truth (it ships in the package); `SKILL.md` is a generated harness
wrapper. Never hand-edit `SKILL.md`.

---

## 2. The evidence bar — "confident enough to ship"

A grounding change ships only when **all** of these hold. If one fails, the PR either doesn't ship or
says explicitly why the exception is justified.

1. **n ≥ 3 runs**, with the model and judge named (default `claude-haiku-4.5` for both). Single-run
   numbers are directional only and never the basis for a ship decision.
2. **Grounded beats baseline on quality**, not just on cost. Cost and correctness wins are necessary
   but not sufficient — if the judge scores grounded *below* baseline, diagnose it (it is often a
   [verifiability artifact](./reports/nugetfetch.md), not weaker code) and fix the grounding before
   shipping. A deliberate quality/cost tradeoff is allowed only if stated and defended.
3. **Functional assertions (`func`) do not regress.** Build + file + run-output gates must stay at or
   above baseline.
4. **Claims rest on normative metrics, never on signals.** See §3.
5. **Cost is reported three ways** — gross `tok`, cache-excluded `iet`, and `cost` — because a
   baseline that re-reads a big cache inflates `tok` while `iet`/`cost` tell the real story. IET is
   the headline cost stick (`README.md` → "How we measure cost: IET").
6. **Variance is disclosed.** Report the spread / flag high-variance scenarios; do not bury a noisy
   win. If a result hinges on one scenario, say so.
7. **Required caveats are present** (§4): the NuGet-cache contamination confound, and the fact that
   starting cache state is not an experimental variable.

---

## 3. Normative metrics vs. informative signals (do not conflate)

The analyzer (`eng/analyze-6q.py`) prints two column groups on purpose. A conclusion may rest only on
the left group.

- **NORMATIVE METRICS** — what we claim as value or harm: `qual` (judge 1–5), `func` (assertions
  passed), `tok`, `iet`, `cost`, `secs`.
- **INFORMATIVE SIGNALS** — corroborating behavioral data that *explains* why the metrics moved, but
  is never itself the claim: `web`, `tools`, `turns`, `di` (dotnet-inspect calls), `mcp`, `cache`
  (bash rummaging `~/.nuget/packages`), `bash`. A tool call or web fetch adds nothing to the bill on
  its own; its value is interpretive — many signal points together trace the narrative arc
  (archaeology, cache-reflection, compile-retry loops) that gives the token delta its shape.

Write claims as: *"grounding cut IET 3.7× and lifted quality +0.3 (metrics); the baseline's spend is
explained by web archaeology and compile-retry loops it no longer needs (signals)."*

---

## 4. Required methodology caveats

Every grounding report/PR for a package that ships docs must carry these, because they bound the
measurement (full treatment in [`harness.md`](./harness.md)):

- **The baseline is partly self-grounded from the NuGet cache.** A package's `README.md`/`AGENTS.md`
  are packed *inside the nupkg*, so any restore extracts them to `~/.nuget/packages`, where the
  web-blocked baseline can read them. The baseline-vs-grounded gap therefore **understates**
  grounding's value. Attribute cache reads **per arm** via `sessions.db` and count only successful
  tool results — never `grep` the path string across all logs (it over-counts and conflates arms).
- **Starting cache state is not a variable.** For build-based scenarios the agent restores the package
  itself within its first few tool calls, so an empty cache collapses to warm before any
  package-specific work. Treat the cache as fixed (warm); an empty cache is only observable for
  advisory tasks that never build.

---

## 5. PR description format

Use the template (`.github/PULL_REQUEST_TEMPLATE.md`). The required sections:

### Changes
What grounding text changed and **why it is package-specific knowledge**, not a generic process tip.
The justification must point at the package's actual trap (e.g. "NuGetFetch shadows the official NuGet
client, so we name the calls to prove the real API was used").

### Metrics (n=…, model=…, judge=…)
A table over the three arms with the normative metrics, plus the key signals that explain them:

```
| arm      | qual | func  | tok   | iet   | cost | ‖ | web | turns | cache |
| -------- | ---- | ----- | ----- | ----- | ---- | - | --- | ----- | ----- |
| baseline | …    | 26/30 | ~540k | ~…    | 7.7  | ‖ | 0   | …     | …     |
| isolated | …    | 30/30 | ~96k  | ~…    | 1.8  | ‖ | 0   | …     | …     |
| plugin   | …    | 30/30 | ~133k | ~…    | 2.1  | ‖ | 0   | …     | …     |
```

State the grounding investment (the `~tok` size of the loaded `SKILL.md`) the payoff is measured
against.

### Representative check
One concrete before/after: what the **ungrounded** agent reaches for (the hallucinated/wrong API) and
what the grounding makes it do instead. This is the qualitative counterpart to the table.

### Validation (reproducible)
The exact commands a reviewer can rerun:

```bash
eng/sync-skill.sh --check                        # SKILL.md in sync with AGENTS.md
RUNS=3 eng/run-<unit>-6q.sh                       # matched n=3 eval -> data/<unit>-6q/<unit>.haiku.json
python3 eng/analyze-6q.py data/<unit>-6q/<unit>.haiku.json
cp data/<unit>-6q/<unit>.haiku.json data/<unit>-6q/<unit>.n3.haiku.json  # commit the matched run
```

`run-<unit>-6q.sh` writes `<unit>.haiku.json`; we **commit the matched n=3 run** as
`<unit>.n3.haiku.json` so it is not overwritten by a later single-run pass.

### Caveats
The §4 caveats, plus any scenario-specific variance notes.

---

## 6. Reviewer checklist

- [ ] `AGENTS.md` body within the line limit; `eng/sync-skill.sh --check` passes.
- [ ] Dataset committed under `data/<unit>-6q/`; table in the PR matches it (rerun `analyze-6q.py`).
- [ ] n ≥ 3; model and judge named.
- [ ] Grounded ≥ baseline on **quality** and **func**; cost/IET win shown with all three of
      `tok`/`iet`/`cost`.
- [ ] Claims cite normative metrics; signals used only to explain.
- [ ] The grounding text is package-specific, justified by the package's actual trap.
- [ ] Required caveats present; cache reads attributed per arm (not grepped).
- [ ] Report under `docs/reports/<unit>.md` updated.
