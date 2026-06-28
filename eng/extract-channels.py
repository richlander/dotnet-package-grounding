#!/usr/bin/env python3
# Shim: ported to the C# `grounding` CLI (src/grounding). Delegates to
# `eng/grounding channels extract ...`. See src/grounding/README.md.
import os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
launcher = os.path.join(root, "eng", "grounding")
os.execvp(launcher, [launcher, "channels", "extract", *sys.argv[1:]])
