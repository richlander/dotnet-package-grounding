#!/usr/bin/env bash
# Run the package-grounding evals using skill-validator.
#
# Mirrors the pattern dotnet/skills uses for its own evals: BUILD the validator
# from source (`dotnet publish eng/skill-validator/src/SkillValidator.csproj`)
# and run the produced `skill-validator` binary. skill-validator is not on any
# NuGet feed, so we build it from a pinned commit recorded in
# eng/skill-validator.sha. "Updating the harness" = bump that SHA.
#
# The pin lives on a FORK of dotnet/skills, not upstream. This study's protocol
# needs three commits that were never upstreamed: the expected_skill scenario
# prior, holistic eval mode (with the isolated-arm skip), and per-run outcomes
# persisted before averaging. Upstream silently ignores --eval-mode, so building
# from dotnet/skills produces legacy pairwise numbers that are NOT comparable to
# any published card. Override with SKILL_VALIDATOR_REPO only if you have moved
# those commits somewhere else.
#
# Usage:
#   eng/run-evals.sh                         # eval all grounding units
#   eng/run-evals.sh System.CommandLine      # eval one unit
#   TOOLS_DIR=/path eng/run-evals.sh         # reuse a cached source/build
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sha="$(tr -d '[:space:]' < "$repo_root/eng/skill-validator.sha")"
tools_dir="${TOOLS_DIR:-$repo_root/.tools}"
repo_url="${SKILL_VALIDATOR_REPO:-https://github.com/richlander/skills.git}"
unit="${1:-}"

src_dir="$tools_dir/skills-src"
bin_dir="$tools_dir/skill-validator-$sha"
bin="$bin_dir/skill-validator"

# Build the validator from the pinned commit (once per SHA).
if [ ! -x "$bin" ]; then
  echo "Building skill-validator from $repo_url@$sha ..."
  if [ ! -d "$src_dir/.git" ]; then
    rm -rf "$src_dir"; mkdir -p "$src_dir"
    git -C "$src_dir" init -q
    git -C "$src_dir" remote add origin "$repo_url"
  fi
  # A checkout cached from an earlier pin may point at a different remote.
  git -C "$src_dir" remote set-url origin "$repo_url"
  git -C "$src_dir" fetch --depth 1 origin "$sha" -q
  git -C "$src_dir" checkout -q FETCH_HEAD
  # A harness that cannot run the documented protocol is worse than a stale one:
  # upstream accepts --eval-mode and ignores it, so the run looks fine and quietly
  # produces legacy pairwise numbers with a live isolated arm.
  if ! grep -q -- '--eval-mode' "$src_dir/eng/skill-validator/src/Evaluate/EvaluateCommand.cs"; then
    echo "error: $repo_url@$sha has no --eval-mode option, so it cannot run holistic evals." >&2
    echo "       Pin a commit from the holistic-harness branch (see eng/skill-validator.sha)." >&2
    exit 1
  fi
  dotnet publish "$src_dir/eng/skill-validator/src/SkillValidator.csproj" \
    -c Release -o "$bin_dir"
fi

paths=()
if [ -n "$unit" ]; then
  paths+=("$repo_root/grounding/$unit")
else
  paths+=("$repo_root/grounding")
fi

# eval.yaml + fixtures live in a parallel tree: tests/<Package>/eval.yaml.
# The harness resolves <tests-dir>/<grounding-dir-name>/eval.yaml, so the
# grounding folder name (e.g. System.CommandLine) must match the tests folder.
set -x
"$bin" evaluate \
  --tests-dir "$repo_root/tests" \
  "${paths[@]}"
