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
| E  | `inspect-readme` | `dotnet-inspect package <id>@<ver> --readme` CLI ([#960]) | absent (CLI serves README) |
| E′ | `inspect-agents` | `dotnet-inspect package <id>@<ver> --readme` CLI ([#960]) | **present** (CLI serves AGENTS.md) |

[#960]: https://github.com/richlander/dotnet-inspect/pull/960

Channels A and A′ are the **baseline** arm of the `*-realmcp` evals (cache AGENTS absent vs
present); B and C are the **plugin** arm of those same evals; D is the **plugin** arm of the
`*-custommcp` eval. So each `*-realmcp` run captures two channels at once. Channels E and E′ are
the **isolated** arm of the `prefer-dotnet-inspect` directive unit, captured the same way (cache
AGENTS absent vs present) — they are the CLI analog of B and C: the agent fetches the package's
shipped doc with the `dotnet-inspect` CLI instead of the NuGet MCP. They require a `dotnet-inspect`
with [#960] (>= 0.11.0) on PATH. Which doc the CLI actually served (E vs E′) is confirmable from
the tool's own provenance ([#965]): `dotnet-inspect package <id>@<ver> --readme --info` reports
`Readme | <path> (<bytes> B)` (e.g. `AGENTS.md (3390 B)` vs `README.md (18843 B)`) on **stderr**,
while stdout stays the raw document.

[#965]: https://github.com/richlander/dotnet-inspect/pull/965

The canonical `inspect-*.{opus,haiku}.json` reflect the **shipped (no-peek) directive** —
`--readme` fetches the whole doc in one call. An earlier variant that told the agent to peek
`--frontmatter` before pulling `--body` is archived as `inspect-*-peek.*.json`; it was measured out
because it never helped and inflated weak-tier README thrash (see the report's *Frontmatter peek*
section).

## Skill-shelf evals (CT-24 and ablations)

The channel matrix above measures *delivery*. These directories measure *shelf content* — the
pull-installed skill set itself — and are the evidence behind the four-model card in
[markout `grounding/markout/results.md`](https://github.com/richlander/markout/blob/main/grounding/markout/results.md).
markout deliberately ships no datasets in its own bundle, so this is their only home.

| Directory | Suite | Models |
|---|---|---|
| `markout-ct24/` | CT-24 holistic, n=5 per scenario | haiku-4.5, sonnet-5, opus-4.8, opus-5 |
| `markout-ablate/` | skill-subtraction: one domain skill removed at a time | haiku-4.5, opus-4.8 |
| `markout-6q/` | 6-question suite, incl. multi-skill subtraction matrix | haiku-4.5, opus-4.8 |
| `markout-perrun-smoke/` | per-run plumbing smoke test | haiku-4.5 |
| `system-commandline-ct24/` | CT-24; **partial** — only the haiku leg ran | haiku-4.5 |

Two things to know before reading these:

- **`markout-ct24/markout-skill.opus5.json` is renamed.** Every other file keeps the name the
  harness wrote. The opus-4.8 and opus-5 legs were both written as `markout-skill.opus.json` into
  separate cache directories, so one had to be disambiguated. The authoritative model is always the
  `model` field inside the file, never the filename.
- **`provenance.nugetVersion` reads `0.15.0` and is wrong** on the markout runs. It comes from a
  stale `.claude-plugin/plugin.json`; the shelf measured was 0.30.0. Identify a run by
  `provenance.docContentHash`, which is what the harness actually keys on — all four `markout-ct24`
  legs share `sha256:e35d12a6e562295a`, confirming they measured one shelf.

`system-commandline-ct24/` is the only surviving leg of a run that aborted partway; the sonnet and
opus legs, and all of the `system-text-json` run, never completed.

### What is not here

Session transcripts (`~/.cache/grounding/results/`, ~2,400 sessions, 2.7 GB) are deliberately not
committed — roughly 250 MB even compressed, against 5.9 MB for every dataset above. They hold
detail the datasets do not, such as which `SKILL.md` files an agent actually read, so they are worth
keeping outside git rather than discarding.

## How to regenerate

See [`eng/run-channel-matrix.sh`](../eng/run-channel-matrix.sh). Harness build is pinned by
`eng/skill-validator.sha`. For the cross-channel **IET** comparison — plus **HIET**
(Haiku-Equivalent IET: IET × input-price-vs-Haiku, Opus 15× / Sonnet 3× / Haiku 1×, the
dollar-comparable cross-tier view) and the cross-tier table — run
[`eng/compare-channels.py`](../eng/compare-channels.py); the writeup is
[`docs/reports/dotnet-inspect-channel.md`](../docs/reports/dotnet-inspect-channel.md).
