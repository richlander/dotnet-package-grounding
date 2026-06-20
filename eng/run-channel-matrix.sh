#!/usr/bin/env bash
# Run the delivery-channel matrix for the package-grounding study and capture raw
# results.json into data/<task>/. See data/README.md for the channel definitions.
#
# Channels captured per task:
#   A  raw package on disk, README only      (baseline arm, cache AGENTS absent)
#   A' raw package on disk, AGENTS present    (baseline arm, cache AGENTS present -> "invisible")
#   B  real NuGet MCP -> README               (plugin arm of *-realmcp, cache AGENTS absent)
#   C  real NuGet MCP -> AGENTS.md            (plugin arm of *-realmcp, cache AGENTS present)
#   D  our custom MCP (resident_index)        (plugin arm of *-custommcp)
#
# One *-realmcp run yields TWO channels (baseline + plugin) for a given cache state.
#
# Usage:
#   eng/run-channel-matrix.sh markout            # markout task, both tiers
#   RUNS=3 MODELS="claude-opus-4.6 claude-haiku-4.5" eng/run-channel-matrix.sh markout
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TASK="${1:-markout}"
RUNS="${RUNS:-3}"
MODELS="${MODELS:-claude-opus-4.6 claude-haiku-4.5}"
BIN=$(ls -d .tools/skill-validator-*/skill-validator 2>/dev/null | head -1)
[ -x "$BIN" ] || { echo "skill-validator not built; run eng/run-evals.sh once first"; exit 1; }
./eng/gen-plugins.sh >/dev/null

CACHE="$HOME/.nuget/packages/markout/0.13.6"
AGENTS_SRC="grounding/markout/AGENTS.md"
OUT="data/$TASK"; mkdir -p "$OUT"

short() { case "$1" in *opus*) echo opus;; *haiku*) echo haiku;; *sonnet*) echo sonnet;; *) echo "$1";; esac; }

run() {  # run <unit> <results-tag> <extra-env...>
  local unit="$1" tag="$2"; shift 2
  for m in $MODELS; do
    local ms; ms=$(short "$m")
    echo "#### $(date +%H:%M:%S)  $unit  $tag  $ms  (runs=$RUNS) ####"
    rm -rf ".skill-validator-results/cm-$tag-$ms"
    env "$@" "$BIN" evaluate --tests-dir tests --model "$m" --judge-model claude-haiku-4.5 \
      --runs "$RUNS" --keep-sessions --results-dir ".skill-validator-results/cm-$tag-$ms" \
      "grounding/$unit" > ".tools/cm-$tag-$ms.out" 2>&1
    local rj; rj=$(find ".skill-validator-results/cm-$tag-$ms" -name results.json | head -1)
    [ -n "$rj" ] && cp "$rj" "$OUT/$tag.$ms.json" && echo "   -> $OUT/$tag.$ms.json"
  done
}

agents_on()  { cp "$AGENTS_SRC" "$CACHE/AGENTS.md"; echo "cache AGENTS.md: ON"; }
agents_off() { rm -f "$CACHE/AGENTS.md"; echo "cache AGENTS.md: OFF"; }

echo "======== CHANNEL MATRIX: task=$TASK runs=$RUNS models=[$MODELS] ========"
case "$TASK" in
  markout)
    # Single-package anchor: full A / A' / B / C / D matrix via cache toggling.
    agents_on;  run "markout-realmcp"   "realmcp-agents"                              # C + A'
    agents_off; run "markout-realmcp"   "realmcp-noagents"                            # B + A
    agents_on;  run "markout-custommcp" "custommcp" GROUNDING_GATE=resident_index     # D
    ;;
  multipackage)
    # Triage task: A / B / D. Channel C (inject AGENTS into 3 pkg caches at migration
    # versions) is fragile and adds little beyond the markout anchor, so it is omitted
    # here by design (see data/README.md).
    run "nuget-mcp"         "realmcp-noagents"                              # B + A (real NuGet MCP -> README)
    run "multi-package-mcp" "custommcp" GROUNDING_GATE=resident_index       # D     (custom MCP resident index)
    ;;
  *) echo "unknown task '$TASK' (expected: markout | multipackage)"; exit 1;;
esac

echo "======== DONE $(date +%H:%M:%S). Raw data in $OUT/ ========"
ls -la "$OUT"
