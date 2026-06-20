# Raw evaluation data

Canonical raw `results.json` files behind [`docs/recommendation.md`](../docs/recommendation.md)
and the per-package reports in [`docs/reports/`](../docs/reports/).

Each file is the unmodified skill-validator `results.json` for one (task × delivery-channel ×
model-tier) cell. Naming: `<task>/<channel>.<model>.json`.

## Delivery channels

| Ch | id | Delivery mechanism | AGENTS.md in package |
|----|----|--------------------|----------------------|
| A  | `raw-readme`     | raw package on disk (no MCP) | absent (reads README) |
| A′ | `raw-invisible`  | raw package on disk (no MCP) | **present** (still reads README — invisible) |
| B  | `nugetmcp-readme`| real NuGet.Mcp.Server `get_package_context` | absent (serves README) |
| C  | `nugetmcp-agents`| real NuGet.Mcp.Server `get_package_context` | **present** (serves AGENTS.md) |
| D  | `custommcp`      | our controlled grounding MCP (resident-index gate) | served on demand from curated grounding |

Channels A and A′ are the **baseline** arm of the `*-realmcp` evals (cache AGENTS absent vs
present); B and C are the **plugin** arm of those same evals; D is the **plugin** arm of the
`*-custommcp` eval. So each `*-realmcp` run captures two channels at once.

## How to regenerate

See [`eng/run-channel-matrix.sh`](../eng/run-channel-matrix.sh). Harness build is pinned by
`eng/skill-validator.sha`.
