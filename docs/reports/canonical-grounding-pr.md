// Coments provide context and instructions; they are not included in the final PR
// Start with a terse list of changes; Some example changes may not apply at all or as worded
// All the data is examples.

- Adds/Improves `AGENTS.md` grounding information
- Improves `README.md` per grounding evaluation
- Grounding test tasks
- Updated version `x` -> `y`
- Evaluated content with [richlander/dotnet-package-grounding@3bd9749](https://github.com/richlander/dotnet-package-grounding/commit/3bd97493174063c38fd87937642cf17f05c1b09c)

## Metrics

> should we accept this change?

Grounding effectiveness is read off **three single-variable cards**, which were used to gate this change.

- Test iterations: `n=3`
- Test scenarions: `6`
- Models tested: `2`

### Effectiveness

> does grounding help *this* model?

- Baseline: no grounding
- AGENTS.md: `AGENTS.md` (~903 tok, via grounding tool)
- Evaluation mode: `claude-haiku-4.5`
- Judge model: `claude-haiku-4.5`.

| Metric | Baseline | AGENTS.md |
| --- | ---: | ---: |
| success (scenarios) | 5/6 | 6/6 |
| func passed (assertions) | 17/18 | 18/18 |
| resourcefulness (archaeology) | 35 | 0 |
| IET | 31276 | 17558 |
| output tok | 5782 | 1716 |
| cost | 7.75 | 2.28 |

> **Conclusion:** **BETTER** — success 6/6 vs 5/6, resourcefulness 35→0, IET -44%, cost -71%.

- Baseline: no grounding
- AGENTS.md: `AGENTS.md` (~903 tok, via grounding tool)
- Evaluation mode: `claude-opus-4.8`
- Judge model: `claude-haiku-4.5`

| Metric | Baseline | AGENTS.md |
| --- | ---: | ---: |
| success (scenarios) | 6/6 | 6/6 |
| func passed (assertions) | 18/18 | 18/18 |
| resourcefulness (archaeology) | 19 | 0 |
| IET | 29052 | 21967 |
| output tok | 4825 | 1488 |
| cost | 14.35 | 5.45 |

> **Conclusion:** **BETTER** — success 6/6 vs 6/6, resourcefulness 19→0, IET -24%, cost -62%.

Note: The first two rows are quality metrics. The third row is an activity signal. The last three are cost metrics.

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

Note: All rows shows a difference per the baseline. The quality rows should be higher and the cost rows lower. The middle signal row is expected to the follow the trend.

### ③ Source-diff

> Is `AGENTS.md` effective relative to the existing `README.md`; also, should `README.md` be improved?

- README.md: `README.md` (~903 tok, via grounding tool)
- AGENTS.md: `AGENTS.md` (~903 tok, via grounding tool)
- Evaluation mode: `claude-haiku-4.5`
- Judge model: `claude-haiku-4.5`

_`claude-haiku-4.5` · Both surfaced via the grounding tool; baseline removed. Single column = AGENTS.md change vs README.md (− = AGENTS cheaper on cost metrics, + on success/func, lower resourcefulness = AGENTS more self-sufficient). This is what authoring AGENTS.md buys over the README floor._

| Metric | AGENTS.md − README.md |
| --- | ---: |
| success (scenarios) | +2 (6/6) |
| func passed (assertions) | +1 (18/18) |
| resourcefulness (archaeology) | 0→0 |
| IET | -4% |
| output tok | +1% |
| cost | +7% |

> **Conclusion:** **BETTER** — success 6/6 vs 4/6, resourcefulness 0→0, IET -4%, cost +7% _(AGENTS.md graded against the README floor)._

Note: `README.md` acts as baseline. Rows show the different and the end state. Same desired higher and lower values apply. A `README.md` file that cannot to used to answer all test questions is a signal to improve that file. `AGENTS.md` should win on efficiency not on quality when a strong `README.md` exists.

## Validation

```bash
dotnet pack src/NuGetFetch/NuGetFetch.csproj -c Release
unzip -l src/artifacts/package/release/NuGetFetch.0.6.3.nupkg | grep -E 'AGENTS|README'   # both at root
```
Eval (in richlander/dotnet-package-grounding), on a clean box:
```bash
RUNS=3 MODELS=claude-haiku-4.5  eng/run-nugetfetch-6q.sh     # mini WIN
RUNS=3 MODELS=claude-opus-4.8   eng/run-nugetfetch-6q.sh     # frontier no-harm
python3 eng/analyze-6q.py --card        data/nugetfetch-6q/nugetfetch.n3.haiku.json data/nugetfetch-6q/nugetfetch.n3.opus.json
python3 eng/analyze-6q.py --model-diff   data/nugetfetch-6q/nugetfetch.n3.haiku.json data/nugetfetch-6q/nugetfetch.n3.opus.json
python3 eng/analyze-6q.py --source-diff  data/nugetfetch-6q/nugetfetch.n3.haiku.json data/nugetfetch-6q/nugetfetch-readme.n3.haiku.json
```

## Grounding resources

- Methodology: [grounding-eval-methodology.md](https://github.com/richlander/dotnet-package-grounding/blob/main/docs/grounding-eval-methodology.md)
- Lifecycle playbook: [grounding-lifecycle.md](https://github.com/richlander/dotnet-package-grounding/blob/main/docs/grounding-lifecycle.md)
