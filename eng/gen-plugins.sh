#!/usr/bin/env bash
# Shim: ported to the C# `grounding` CLI (src/grounding). Delegates to
# `eng/grounding gen-plugins`. See src/grounding/README.md.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/grounding" gen-plugins "$@"
