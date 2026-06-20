#!/usr/bin/env bash
# Generate SKILL.md from AGENTS.md (+ meta.yaml) for every grounding unit.
# AGENTS.md is the source of truth (it ships in the package root); SKILL.md is a
# generated wrapper that the skill-validator harness can toggle on/off.
#
# Usage:
#   eng/sync-skill.sh            # regenerate all SKILL.md files
#   eng/sync-skill.sh --check    # fail if any SKILL.md is stale (for CI)
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
check_mode="${1:-}"
status=0

# Grounding AGENTS.md files must stay tight. Limit is configurable; start at 60.
line_limit="$(tr -d '[:space:]' < "$repo_root/eng/agents-line-limit.txt")"

extract_meta() { # $1=file $2=key  -> prints folded scalar value (handles >-, >, |, |-)
  awk -v key="$2" '
    $0 ~ "^"key":" {
      sub("^"key":[[:space:]]*", "")
      val=$0
      if (val == ">-" || val == ">" || val == "|" || val == "|-") {
        val=""
        while ((getline line) > 0) {
          if (line ~ /^[^[:space:]]/) break
          sub(/^[[:space:]]+/, "", line)
          val = (val == "" ? line : val " " line)
        }
      }
      print val
      exit
    }
  ' "$1"
}

# Print the YAML frontmatter block of an AGENTS.md (lines between the first two ---).
front_matter() { # $1=file
  awk 'NR==1 && $0=="---"{f=1; next} f==1 && $0=="---"{exit} f==1{print}' "$1"
}

# Print the body of an AGENTS.md (everything after a leading --- ... --- block, with
# leading blank separator lines removed; if there is no frontmatter, print the whole file).
strip_frontmatter() { # $1=file
  awk 'NR==1 && $0=="---"{f=1; next}
       f==1 && $0=="---"{f=2; next}
       f==2 && started==0 && $0 ~ /^[[:space:]]*$/{next}
       f!=1{started=1; print}' "$1"
}

while IFS= read -r -d '' agents; do
  dir="$(dirname "$agents")"
  meta="$dir/meta.yaml"
  skill="$dir/SKILL.md"
  [ -f "$meta" ] || { echo "WARN: $dir has AGENTS.md but no meta.yaml; skipping"; continue; }

  # name/description are the source of truth in AGENTS.md frontmatter; meta.yaml is a
  # fallback for units not yet migrated. Body excludes the frontmatter block.
  fm="$(mktemp)"; body="$(mktemp)"
  front_matter "$agents" > "$fm"
  strip_frontmatter "$agents" > "$body"

  name="$(extract_meta "$fm" name)"
  [ -n "$name" ] || name="$(extract_meta "$meta" name)"
  description="$(extract_meta "$fm" description)"
  [ -n "$description" ] || description="$(extract_meta "$meta" description)"

  # Enforce the line-count budget on the AGENTS.md body (frontmatter excluded).
  lines="$(grep -c '' "$body")"
  if [ "$lines" -gt "$line_limit" ]; then
    echo "TOO LONG: $agents body has $lines lines (limit $line_limit). Trim it or raise eng/agents-line-limit.txt."
    status=1
  fi

  # YAML-escape the description: it routinely contains ': ', '<', '>' etc.,
  # which are invalid in an unquoted (plain) scalar. Emit a double-quoted scalar.
  esc_description="$(printf '%s' "$description" | sed 's/\\/\\\\/g; s/"/\\"/g')"

  tmp="$(mktemp)"
  {
    echo "---"
    echo "name: $name"
    echo "description: \"$esc_description\""
    echo "---"
    echo
    echo "<!-- GENERATED from AGENTS.md by eng/sync-skill.sh. Do not edit. -->"
    echo
    cat "$body"
  } > "$tmp"
  rm -f "$fm" "$body"

  if [ "$check_mode" = "--check" ]; then
    if ! diff -q "$tmp" "$skill" >/dev/null 2>&1; then
      echo "STALE: $skill (run eng/sync-skill.sh)"
      status=1
    fi
    rm -f "$tmp"
  else
    mv "$tmp" "$skill"
    echo "wrote $skill"
  fi
done < <(find "$repo_root/grounding" -name AGENTS.md -print0)

exit $status
