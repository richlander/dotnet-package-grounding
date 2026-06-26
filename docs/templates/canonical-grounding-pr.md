<!--
Comments provide context and instructions; they are not included in the final PR.
Start with a terse list of changes; some example changes may not apply, or apply differently.
The metric data below is an example (NuGetFetch).
-->

- Adds/Improves `AGENTS.md` grounding information
- Improves `README.md` per grounding evaluation ([usability gaps](<readme-issue>))
- Grounding test tasks — the questions this change is gated on: [`tests/<unit>/eval.yaml`](<eval-link>)
- Updated version `x` -> `y`
- Evaluated content with [richlander/dotnet-package-grounding@`<commit>`](https://github.com/richlander/dotnet-package-grounding/commit/<commit>)

## Metrics

> should we accept this change?

Grounding effectiveness is read off **three single-variable cards**, which were used to gate this change.

- Test iterations: `n=3`
- Test scenarios: `6`
- Models tested: `2`

### Effectiveness

> does grounding help *this* model?

_`claude-haiku-4.5` · baseline (no grounding) vs `AGENTS.md` (~<tok>) · judge `claude-haiku-4.5`_

| Metric | Baseline | AGENTS.md |
| --- | ---: | ---: |
| success (scenarios) | 5/6 | 6/6 |
| func passed (assertions) | 17/18 | 18/18 |
| resourcefulness (archaeology) | 35 | 0 |
| IET | 31276 | 17558 |
| output tok | 5782 | 1716 |
| cost | 7.75 | 2.28 |

> **Conclusion:** **BETTER** — success 6/6 vs 5/6, resourcefulness 35→0, IET -44%, cost -71%.

_`claude-opus-4.8` · baseline (no grounding) vs `AGENTS.md` (~<tok>) · judge `claude-haiku-4.5`_

| Metric | Baseline | AGENTS.md |
| --- | ---: | ---: |
| success (scenarios) | 6/6 | 6/6 |
| func passed (assertions) | 18/18 | 18/18 |
| resourcefulness (archaeology) | 19 | 0 |
| IET | 29052 | 21967 |
| output tok | 4825 | 1488 |
| cost | 14.35 | 5.45 |

> **Conclusion:** **BETTER** — success 6/6 vs 6/6, resourcefulness 19→0, IET -24%, cost -62%.

Note: rows 1–2 are **correctness** (higher is better); row 3 is **resourcefulness** — the out-of-sandbox archaeology grounding eliminates (drive to 0); rows 4–6 are **cost** (lower is better).

### Model difference

> Does grounding improve performance (Pareto improvement)?

| Metric | `claude-haiku-4.5` | `claude-opus-4.8` |
| --- | ---: | ---: |
| success (scenarios) | +1 (6/6) | +0 (6/6) |
| func passed (assertions) | +1 (18/18) | +0 (18/18) |
| resourcefulness (archaeology) | 35→0 | 19→0 |
| IET | -44% | -24% |
| output tok | -70% | -69% |
| cost | -71% | -62% |
| **→ verdict** | **BETTER** — success 6/6 vs 5/6, resourcefulness 35→0, IET -44%, cost -71% | **BETTER** — success 6/6 vs 6/6, resourcefulness 19→0, IET -24%, cost -62% |

Note: each cell is the change vs that model's own baseline — correctness up, resourcefulness and cost down.

### Source-diff

> Is `AGENTS.md` effective relative to the existing `README.md`; also, should `README.md` be improved?

_`claude-haiku-4.5` · `AGENTS.md` (~<tok>) vs the package `README.md` (typically far larger), both via the grounding tool, baseline removed · judge `claude-haiku-4.5`. Single column = AGENTS.md − README.md (− = AGENTS cheaper on cost, + on success/func, lower resourcefulness = more self-sufficient). The README is co-tested here as a usability artifact._

| Metric | AGENTS.md − README.md |
| --- | ---: |
| success (scenarios) | +2 (6/6) |
| func passed (assertions) | +1 (18/18) |
| resourcefulness (archaeology) | 0→0 |
| IET | -4% |
| output tok | +1% |
| cost | +7% |

> **Conclusion:** **BETTER** — success 6/6 vs 4/6, resourcefulness 0→0, IET -4%, cost +7% _(README arm is co-tested for usability, not a floor to beat)._

Note: `README.md` acts as the baseline; rows show the difference and the end state (same higher/lower targets apply). A `README.md` that cannot be used to answer all test questions is a signal to improve that file. When a strong `README.md` exists, `AGENTS.md` should win on efficiency, not correctness.

## Analysis

<!-- One line: what grounding actually changes. State it from the transcripts, not a guess. -->
Grounding eliminates the resourcefulness (cache/web archaeology) the agent otherwise spends to reach the *same* correct API; on the weak tier it also rescues scenarios the ungrounded model fails.

## Caveats

The baseline self-grounds from the restored NuGet cache (README/AGENTS ship in the nupkg), so its resourcefulness is a **lower bound** — grounding's advantage is understated. Cache state is not a variable.

## Validation

```bash
dotnet pack src/<Package>/<Package>.csproj -c Release
unzip -l src/artifacts/package/release/<Package>.<y>.nupkg | grep -E 'AGENTS|README'   # both at root
```
Eval (in richlander/dotnet-package-grounding), on a clean box:
```bash
RUNS=3 MODELS=claude-haiku-4.5  eng/run-<unit>-6q.sh     # mini: expect BETTER
RUNS=3 MODELS=claude-opus-4.8   eng/run-<unit>-6q.sh     # frontier: expect not-WORSE
python3 eng/analyze-6q.py --card        data/<unit>-6q/<unit>.n3.haiku.json data/<unit>-6q/<unit>.n3.opus.json
python3 eng/analyze-6q.py --model-diff   data/<unit>-6q/<unit>.n3.haiku.json data/<unit>-6q/<unit>.n3.opus.json
python3 eng/analyze-6q.py --source-diff  data/<unit>-6q/<unit>.n3.haiku.json data/<unit>-6q/<unit>-readme.n3.haiku.json
```

## Grounding resources

- Test questions: [`tests/<unit>/eval.yaml`](<eval-link>) · Datasets: `data/<unit>-6q/` (committed for `--baseline-from` reuse)
- Methodology: [grounding-eval-methodology.md](https://github.com/richlander/dotnet-package-grounding/blob/main/docs/grounding-eval-methodology.md)
- Lifecycle playbook: [grounding-lifecycle.md](https://github.com/richlander/dotnet-package-grounding/blob/main/docs/grounding-lifecycle.md)
