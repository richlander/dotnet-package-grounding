# Canonical grounding PR template

Grounding for `<package>`: grounded vs baseline on CT-24, using the package `SKILL.md` skill set.

## Claim

Installing the `<package>` skill set improves `<return and/or efficiency claim>` for `<model tier(s)>`
without measurable harm, under the quality-card model.

## What ships

- Base skill: `<skill-name>/SKILL.md`
- Domain skills: `<domain-skill-list>`
- Supporting files: `<supporting-files>`
- Install path: `<install-path>`

## Eval setup

| Field | Value |
| --- | --- |
| Suite | CT-24 |
| Runs | k=5 |
| Models | `claude-haiku-4.5`, `claude-sonnet-5`, `claude-opus-4.8` |
| Command | `grounding run <slug> --source skill --eval-mode holistic --runs 5` |
| Package version | `<version>` |
| Dataset(s) | `<paths-or-links>` |
| Judge / assertion config | `<config>` |

## Quality card

### RETURN

| Row | Baseline | Grounded | Delta / interval | Notes |
| --- | ---: | ---: | ---: | --- |
| Graded yield: Fails | `<n>` | `<n>` | `<Δ>` | Lower is better. |
| Graded yield: Satisfies | `<n>` | `<n>` | `<Δ>` | Works, but not as asked. |
| Graded yield: Delivers | `<n>` | `<n>` | `<Δ>` | Full-price unit. |
| Capability wins | `<n>` | `<n>` | `<Δ>` | Tasks only grounded delivered. |
| Shared-success reliability `ΔP` | `<p>` | `<p>` | `<CI>` | Shared-success set only. |
| Loss mass | `<mass>` | `<mass>` | `<null-95 comparison>` | Must pass do-no-harm. |

### EFFICIENCY

| Row | Baseline | Grounded | Ratio / interval | Notes |
| --- | ---: | ---: | ---: | --- |
| Per-dollar IET over delivered runs | `<iet>` | `<iet>` | `<ratio, CI>` | Gated headline. |
| Cost per delivered run | `<$>` | `<$>` | `<ratio, CI>` | Should agree with IET. |
| Per-day duration | `<sec/day>` | `<sec/day>` | `<ratio, CI>` | Co-headline, not a gate. |
| Output tokens | `<tok>` | `<tok>` | `<ratio>` | Expensive class; explanatory. |
| Resourcefulness | `<events>` | `<events>` | `<Δ>` | Web/cache/decompile archaeology. |

## Ship gates

| Gate | Requirement | Result | Pass? |
| --- | --- | --- | --- |
| Do no harm | Loss mass clears the null-95 baseline | `<result>` | `<yes/no>` |
| Economic materiality | Per-dollar CI upper bound `≤ ×0.80` | `<result>` | `<yes/no>` |

## Representative evidence

- `<task-id>`: `<baseline behavior>` → `<grounded behavior>`
- `<task-id>`: `<resourcefulness or cost movement>`
- `<task-id>`: `<any regression, flake, or confound>`

## Confounds and judgment calls

- `<archaeology, tool-policy, package-cache, prompt, assertion, or model-specific note>`
- `<why the claim is still supported or why it is limited>`

## Validation

```bash
grounding run <slug> --source skill --eval-mode holistic --runs 5
```

Optional, for mid-transition units that still use the legacy grounding-file budget check:

```bash
```

## Reviewer checklist

- [ ] The PR states a grounded-vs-baseline claim.
- [ ] The run uses CT-24, k=5, and all three model tiers or explains any omission.
- [ ] RETURN rows include graded yield, reliability, and loss mass.
- [ ] EFFICIENCY rows include per-dollar IET and duration.
- [ ] Both ship gates pass or the PR explicitly says the skill set should not ship.
- [ ] The skill content is package-local, first-party, and tied to measured gaps.
