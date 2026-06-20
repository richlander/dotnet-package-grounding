---
name: markout-realmcp
description: "Experiment harness shell: attaches the real NuGet.Mcp.Server to the Markout task. Carries no inline grounding; package context is delivered only via the real server's get_package_context tool (README or AGENTS.md, depending on what ships in the package)."
---

<!-- INTENTIONALLY INERT. This skill ships NO grounding content. It exists only to
attach the REAL NuGet.Mcp.Server (see plugin.json) to the evaluated run, so we can
measure the upstream server's delivery and call behavior against a raw baseline. -->

# (no inline guidance)
