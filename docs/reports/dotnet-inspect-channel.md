# Does `dotnet-inspect` fit our cost regime as a delivery channel?

**Date:** 2026-06-21
**Question:** the package-grounding study delivers grounding through the **NuGet MCP**
(`get_package_context`). [`dotnet-inspect`](https://github.com/richlander/dotnet-inspect) PR
[#960](https://github.com/richlander/dotnet-inspect/pull/960) added `package --readme`, which
returns a package's single best shipped doc (`AGENTS.md` > `README.md` > `PACKAGE.md`). That makes
the **CLI** an alternative delivery mechanism for the same content. Does it land in the same cost
regime as the MCP, or is the channel a tax?

## Setup

Same Markout M1 task and content as the [Markout report](./markout.md), varying **only delivery**.
The new channel is the `prefer-dotnet-inspect` directive unit: a package-agnostic skill that tells
the agent to run `dotnet-inspect package <id>@<ver> --readme` (no MCP). It is the CLI analog of the
NuGet MCP — `AGENTS.md` present in the package → it serves `AGENTS.md` (E′); absent → it serves the
README (E), the same cache toggle that produces MCP channels C and B. runs=3, judge fixed
(`claude-haiku-4.5`). Cost is weighted [IET](../recommendation.md) (`tEst` = raw harness estimate).

Tool-call breakdown confirms the arms are what they claim: E/E′ carry the doc via `bash` →
`dotnet-inspect` (the directive `skill` loaded, **no** MCP tool); B/C/D carry it via the MCP
`get_package_context` tool.

## Result (runs=3; directional)

The CLI directive ships **without** a frontmatter-peek step (`--readme` fetches the whole doc in one
call); see [Frontmatter peek: measured and dropped](#frontmatter-peek-measured-and-dropped) below for
why.

| Ch | Delivery | Opus IET (tEst) | Haiku IET (tEst) | quality (O/H) | done |
|----|----------|----------------:|-----------------:|:-------------:|:----:|
| A  | baseline — no MCP/CLI, mines README on disk | 77.6k (397k) | 49.3k (172k) | 4.7 / 4.3 | ✓ |
| B  | NuGet MCP → README | 37.8k (118k) | 40.1k (147k) | 4.3 / 4.0 | ✓ |
| C  | NuGet MCP → AGENTS.md | **28.1k** (105k) | 39.4k (122k) | 4.0 / 4.3 | ✓ |
| D  | custom MCP (resident index) → AGENTS | 31.2k (91k) | **30.9k** (106k) | 4.3 / 4.7 | ✓ |
| **E′** | **dotnet-inspect CLI → AGENTS.md** | **35.9k** (107k) | **41.9k** (113k) | 4.3 / 5.0 | ✓ |
| **E**  | **dotnet-inspect CLI → README** | 41.1k (120k) | 47.5k (140k) | 4.0 / 4.0 | ✓ |

Reproduce: `grounding channels compare` (reads `data/markout/*.json`).

## Reading

1. **The CLI lands in the MCP's cost regime — when it delivers `AGENTS.md`.** Channel **E′**
   (`dotnet-inspect → AGENTS.md`) is **35.9k IET on Opus** and **41.9k on Haiku**, sitting right
   alongside the NuGet-MCP `AGENTS.md` channel C (28.1k / 39.4k) and **~54% under the README-mining
   baseline** at the frontier, at do-no-harm quality (4.3 / 5.0, both tiers pass). The dotnet-inspect
   delivery channel is **viable** — it is not a different order of magnitude from the MCP.

2. **The CLI's small premium is extra *round-trips*, not an expensive CLI — and part of it is a
   delivery artifact.** At the frontier E′ (35.9k IET) is ~5–8k above C (28.1k) and D (31.2k), and
   this holds under *every* cost model — IET (cacheRead 0.1×), `tEst` (cache at full price: C 104.5k
   vs E′ 106.9k), and a cold-start no-cache model (C 110.6k vs E′ 113.2k) — so it is **not** an
   artifact of IET discounting the MCP's tool-schema as cache-reads. The tool breakdown pinpoints it:
   the doc itself is the *same* ~1k-token `AGENTS.md` in both arms, but on Opus E′ runs **6 turns vs
   C's 5**, and its two extra calls are a **`skill` load** and an **orientation `view`** on top of
   swapping the MCP call for `bash` (E′: skill×1, bash×2, view×3; C: get_package_context×1, bash×1,
   view×2). Each extra round-trip re-feeds the growing context as fresh input (+8k). **The `skill`
   load is a harness *delivery* artifact, not a `dotnet-inspect` cost**: skill-validator delivers a
   directive by loading its `SKILL.md` via the `skill` tool — a mandatory pick-up step the MCP arm
   never pays (its tool is resident from turn 0). Deliver the directive **resident** (always-present
   `AGENTS.md` / system prompt, as the resident-index channel D does) and the CLI sheds that
   round-trip and likely the orientation view, closing most of the gap. **None of this says "MCP is
   the more efficient mechanism" in general.** MCP's well-known cost is *up-front tool-schema bloat
   that grows with the number of tools* (cf. Anthropic's "code execution with MCP"); but here the
   NuGet MCP is a single small server whose schema is only ~5–6k cached tokens — trivial next to the
   shared context — and the CLI does not avoid an up-front payload anyway (it loads its own
   directive). So in the *many-servers/many-tools* regime the CLI/code path can win on fixed cost; for
   **this** single version-pinned doc fetch the MCP's one-call return is marginally leaner, and the
   two are otherwise
   the same regime.

3. **The README is the more expensive doc in every channel — including the CLI.** Channel **E**
   (`dotnet-inspect → README`) is the most expensive AGENTS-vs-README cell on both tiers (Opus 41.1k
   vs E′ 35.9k; Haiku 47.5k vs E′ 41.9k) and quality-worse on Opus (4.0 vs 4.3): the agent pays for
   the 18.8 KB README pulled through the CLI rather than the 3.4 KB `AGENTS.md`. This reproduces the
   [README-liability finding](./readme-liability.md) on a new channel: the lever is the **content**
   (`AGENTS.md`), and the channel only matters insofar as it delivers that content rather than the
   README. (An earlier run *with* a frontmatter-peek instruction pushed E on Haiku to 63.9k — *worse
   than doing nothing*; that was a directive artifact, not the channel. See below.)

## Frontmatter peek: measured and dropped

`dotnet-inspect --readme` can split a doc into `--frontmatter` (YAML) and `--body`. An earlier draft
of the directive told the agent to **peek the frontmatter first, then fetch the body only if
relevant** — the intuition being "don't pull the whole doc to decide if it's relevant." We A/B'd it
(same matrix, runs=3) by removing that step:

| Cell | with peek IET | no-peek IET | Δ | tools (peek→no) | quality (peek→no) |
|------|--------------:|------------:|--:|:---------------:|:-----------------:|
| Opus / AGENTS (E′)  | 35,793 | 35,906 | +0.3% | 9.0 → 9.0 | 4.30 → 4.30 |
| Haiku / AGENTS (E′) | 39,229 | 41,875 | +6.7% | 8.0 → 9.0 | 4.70 → 5.00 |
| Opus / README (E)   | 41,085 | 41,079 | ~0    | 9.0 → 9.0 | 4.70 → 4.00 |
| Haiku / README (E)  | 63,888 | **47,501** | **−26%** | 10.0 → 9.0 | 4.00 → 4.00 |

**The peek is never a win.** On the path it targets (`AGENTS.md`) it is within noise on both tiers —
because `AGENTS.md` is deliberately tiny (3.4 KB), so there is nothing to save by reading the
frontmatter first; you fetch the whole thing anyway, just over an extra `bash` round-trip. On the
README fallback it is neutral-to-harmful: on Haiku the peek instruction made the weak model **thrash
an extra 26% IET** (it peeked, then pulled the body, then re-read). The peek is **self-defeating for
the short, agent-targeted doc it is built around**, so the shipped directive drops it. (Peek-variant
raw data archived as `data/markout/inspect-*-peek.*.json`.)

## HIET — the cross-tier view that carries the thesis

IET above is a **within-model** cost proxy: it normalizes token *classes* (output 5× input, etc.)
in units of *that model's own* input tokens. It deliberately cancels the per-model base price, which
is exactly what makes same-model arm comparisons clean — but it also **hides** that an Opus input
token costs far more dollars than a Haiku one. **HIET (Haiku-Equivalent IET)** restores that
dimension: scale IET by the model's input list-price relative to Haiku (Anthropic per-MTok input:
Opus $15, Sonnet $3, Haiku $1 → **15× / 3× / 1×**), so every cell is expressed in Haiku-input-token
equivalents and is **directly dollar-comparable across tiers**. (`HIET = IET × ratio`; keep IET for
same-model comparisons, read HIET when comparing tiers.)

| Ch | Delivery | Opus HIET | Haiku HIET | quality (O/H) | Opus $ / Haiku $ |
|----|----------|----------:|-----------:|:-------------:|:----------------:|
| A  | baseline — mines README on disk | **1,163,847** | 49,295 | 4.7 / 4.3 | 23.6× |
| B  | NuGet MCP → README | 567,472 | 40,148 | 4.3 / 4.0 | 14.1× |
| C  | NuGet MCP → AGENTS.md | 421,622 | 39,395 | 4.0 / 4.3 | 10.7× |
| D  | custom MCP → AGENTS | 468,446 | **30,937** | 4.3 / **4.7** | 15.1× |
| E′ | dotnet-inspect → AGENTS.md | 538,582 | 41,875 | 4.3 / **5.0** | 12.9× |
| E  | dotnet-inspect → README | 616,182 | 47,501 | 4.0 / 4.0 | 13.0× |

Reproduce: `grounding channels compare` (HIET columns + cross-tier table).

**What HIET proves that IET cannot:**

1. **The dominant cost lever is the *tier*, not the within-tier token trim.** Grounding cuts Opus
   IET ~50–64% (C/E′ vs A) — real, but second-order. The first-order fact is the **15× price gap**:
   the *best* grounded Opus cell (C, 421,622 HIET) is still **~13.6×** the grounded-Haiku cell
   (D, 30,937 HIET). No amount of within-Opus optimization closes that; only running the cheaper
   tier does.

2. **Grounding's headline payoff is enabling the downshift at equal-or-better quality.** Opus
   *baseline* reaches 4.70 at **1,163,847 HIET**. Haiku **+ grounding** reaches **4.70 at 30,937
   HIET** (custom MCP, D) or **5.00 at 41,875 HIET** via the dotnet-inspect CLI (E′) — **~28–38×
   cheaper at matched-or-higher quality, on either delivery channel.** That is the thesis of this work
   in one row: grounding makes a cheap model do a frontier model's job, and **HIET is the only metric
   that prices the win** (IET shows Opus C as "cheapest" — 28.1k — precisely because it suppresses the
   15×).

3. **The channel choice (MCP vs CLI) is noise next to the tier choice.** E′ vs C/D differ by a few k
   IET within a tier; across tiers they collapse into the same ~31–42k Haiku-HIET band. The CLI is a
   legitimate delivery path for the same downshift.

## Recommendation

- **`dotnet-inspect --readme` is a legitimate alternative delivery channel.** When the package ships
  `AGENTS.md`, the CLI is MCP-comparable in cost and do-no-harm in quality — useful in hosts without
  the NuGet MCP, or as a deterministic, version-pinned fetch (`<id>@<ver>`).
- **Per single call, the MCP is marginally leaner — but that is not a verdict on the mechanism.**
  The MCP's one structured return beats the CLI's bash round-trip *for one small doc* by ~2% even at
  full cache price (the CLI adds ~8k fresh-input stdout tokens and 2 extra round-trips). That is a
  marginal-cost effect, not the MCP up-front-schema tax — which is negligible here (one small server)
  and reverses only with many tools/servers (schema tax dominates → CLI/code wins). Prefer whichever
  the host already runs; the CLI's standalone value is reach (any shell) and deterministic version
  pinning (`<id>@<ver>`), plus the [resident-index gap](https://github.com/richlander/dotnet-inspect/issues/973)
  it could close at project scope.
- **Same gate as everywhere: ship `AGENTS.md`, not a fat README.** The CLI inherits the README
  liability wholesale; the channel is only as good as the doc it is pointed at.
- **Keep directives lean.** The frontmatter-peek step was measured out (above): it never helped and
  hurt the weak tier on the README fallback. Tell the agent to fetch `--readme` and follow it — no
  more.

> Caveat: runs=3, varianceCV is high on this task (see the Markout report). The robust claims are the
> ones that survive that noise: E′ is in the MCP's band and ~½ the frontier baseline; E (README via
> CLI) is the most expensive AGENTS-vs-README cell on both tiers; and — across tiers (HIET) — the
> tier choice dwarfs the channel choice. Firm at runs=5 before quoting point IETs.
>
> Caveat (delivery is not apples-to-apples): the MCP arm's tool is **resident from turn 0**, while the
> CLI arm must **load the directive via the `skill` tool** before acting. So C-vs-E′ compares
> *resident tool* against *skill-loaded directive + CLI*, not the bare fetch. On the fetch itself
> (one `get_package_context` vs one `bash dotnet-inspect`, same doc) they are at parity; the gap is
> the skill-load + orientation round-trip. This **over-penalizes the CLI/directive channel** relative
> to a real deployment, where grounding would ship resident (always-present `AGENTS.md` / system
> prompt) — the apples-to-apples form is resident-directive+CLI vs resident-MCP-tool, ≈ channel D
> (resident index), which is already *cheaper* than E′.
>
> Caveat (resident context is under-measured): `cacheWriteTokens` is reported as **0 for every arm**
> in this dataset, so the one-time *load* of resident context — system prompt **and the MCP tool
> schema** — is never charged; it is counted only as cheap `cacheRead` (0.1× in IET) on later turns.
> The MCP schema is therefore *measured but under-priced*, and its resident-payload signal is small
> and noisy anyway (C−E′ `cacheRead` = +5.7k on Opus but −3.6k on Haiku, swamped by E′'s extra turn).
> This under-pricing of resident delivery further flatters the MCP versus the directive's *visible,
> fully-counted* `skill`-load round-trip. (Side effect: with `cacheWrite ≡ 0`, IET's `1.25·cacheWrite`
> term never fires here — effectively `IET = fresh + 0.1·cacheRead + 5·output` for this data.)

## Fixing the measurement: delivery-normalized IET (IET\*)

The two caveats above share one root cause and one fix. An MCP server's tool schema (and the
system prompt) is cache-**written** during an *unmeasured* session-setup phase
(`session.mcp_servers_loaded` / `tools_updated` emit no usage event), so the arm enters **turn 1
with that payload already cached** and only ever pays `0.1×` `cacheRead` for it. A skill/directive
instead lands as `1×` **fresh** input on turn 1. Same resident payload, charged `0.1×` via MCP but
`1×` via a directive — an apples-to-oranges discount that can exceed the whole channel gap.

The fix needs no new data, only a fair convention: **charge every arm's turn‑1 resident prefix once
at full price.** The only unfairly-discounted quantity is each arm's *turn‑1 `cacheRead`* (its
pre‑warmed prefix), so re‑price it `0.1× → 1×`:

```
IET* = IET + (1 − 0.1)·turn1_cacheRead        # = IET + 0.9·turn1_cacheRead
```

`turn1_cacheRead` is read from the per-turn `assistant.usage` events. Directive/CLI arms enter fresh
(`turn1_cacheRead = 0`) and are unchanged; MCP-resident arms carry ~8–11k pre-warmed tokens and move
up. The verdict **flips**:

| channel | Opus IET | Opus IET\* | Haiku IET | Haiku IET\* |
| --- | ---: | ---: | ---: | ---: |
| C  NuGet MCP → AGENTS | 28,108 | **37,767** | 39,395 | **49,050** |
| D  custom MCP (resident index) → AGENTS | 31,230 | 38,593 | 30,937 | 38,296 |
| E′ dotnet-inspect CLI → AGENTS | 35,906 | **35,906** | 41,875 | **41,875** |

Under reported IET the NuGet MCP (C) looks ~8k cheaper than the CLI (E′); under IET\* that advantage
**evaporates** — on Opus E′ (35,906) is the *cheapest grounded channel*, below C, B, and D; on Haiku
E′ (41,875, quality 5.0) beats both NuGet-MCP channels and trails only the resident custom index (D).
The only channel that stays genuinely cheap after normalization is D — and that is the *design*
lesson, not a measurement one: D's grounding is **resident**, exactly the apples-to-apples form a
real directive deployment takes (always-present `AGENTS.md` / system prompt).

Three levels of fix, in order of leverage:

1. **Analysis (done here):** delivery-normalized IET\* — re-price the turn‑1 resident prefix at `1×`.
   Implemented in `grounding rescore` (`arm_iet_norm`) and surfaced as the `IET*` column in
   `grounding channels compare`. Use IET\* whenever comparing a *resident* delivery (MCP) against a
   *loaded* one (skill/CLI).
2. **Design:** make the directive resident like the MCP (channel D). This is the deployment we
   actually recommend, and it is already competitive on raw IET — normalization just confirms it.
3. **Source:** have the skill-validator / Copilot SDK emit setup-phase cache-**creation** usage so
   `cacheWrite` is populated and the one-time resident load is priced directly, no normalization
   needed. (Upstream ask; tracked for the v-team.)

> Caveat (IET\* is directional): the `metrics.events` array is a single representative run, while the
> aggregate `metrics` average 3 runs, so `turn1_cacheRead` is noisy across arms (e.g. B shows 0 on the
> Opus representative run but 10.7k on Haiku). The *direction* — MCP-resident arms carry a turn‑1
> pre-cache that directive/CLI arms do not — is robust; the point IET\* values are not. Firm at runs=5
> and per-run event capture before quoting them.
