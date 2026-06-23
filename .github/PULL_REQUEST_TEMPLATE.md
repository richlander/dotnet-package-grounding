<!--
Grounding content PR? Follow the standard: docs/eval-grounding-prs.md
A grounding change is a claim — it ships with its evidence. Fill every section.
For non-grounding PRs, delete this template and describe your change normally.
-->

## Changes

<!-- What grounding text changed, and WHY it is package-specific knowledge (point at the package's
actual trap), not a generic process tip. -->

Unit: `grounding/<unit>` · Package: `<Name> <version>` · `AGENTS.md` body lines: `<n>/60`

## Metrics

<!-- n>=3. Name model + judge. Computed from the committed dataset. NORMATIVE on the left, SIGNALS
on the right. State the grounding investment (~tok of the loaded SKILL.md). -->

`n=<runs>` · `model=claude-haiku-4.5` · `judge=claude-haiku-4.5` · grounding `~<tok>`

| arm      | qual | func | tok | iet | cost | ‖ | web | turns | cache |
| -------- | ---- | ---- | --- | --- | ---- | - | --- | ----- | ----- |
| baseline |      |      |     |     |      | ‖ |     |       |       |
| isolated |      |      |     |     |      | ‖ |     |       |       |
| plugin   |      |      |     |     |      | ‖ |     |       |       |

## Representative check

<!-- One concrete before/after: what the UNGROUNDED agent reaches for (wrong/hallucinated API) vs
what the grounding makes it do. -->

## Validation

```bash
eng/sync-skill.sh --check
RUNS=3 eng/run-<unit>-6q.sh                       # -> data/<unit>-6q/<unit>.haiku.json
python3 eng/analyze-6q.py data/<unit>-6q/<unit>.haiku.json
cp data/<unit>-6q/<unit>.haiku.json data/<unit>-6q/<unit>.n3.haiku.json   # commit matched n=3
```

## Caveats

<!-- Required: (1) baseline is partly self-grounded from the NuGet cache (gap understates grounding);
(2) starting cache state is not a variable. Plus any scenario-specific variance notes. -->

## Checklist

- [ ] `AGENTS.md` within line limit; `sync-skill.sh --check` passes
- [ ] Dataset committed under `data/<unit>-6q/`; table matches `analyze-6q.py`
- [ ] n ≥ 3; model + judge named
- [ ] Grounded ≥ baseline on **quality** and **func**; cost shown as `tok`/`iet`/`cost`
- [ ] Claims cite normative metrics; signals only explain
- [ ] Grounding text is package-specific, justified by the package's trap
- [ ] Required caveats present; cache reads attributed per arm (not grepped)
- [ ] `docs/reports/<unit>.md` updated

<sub>Standard: [docs/eval-grounding-prs.md](../docs/eval-grounding-prs.md)</sub>
