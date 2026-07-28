---
name: markout-custommcp
description: "Experiment harness shell for the custom MCP delivery environment on the Markout task. Carries no inline grounding; curated package context is delivered only via the get_package_context MCP tool when the agent chooses to call it (gate under test = GROUNDING_GATE)."
---

<!-- INTENTIONALLY INERT. This skill ships NO grounding content. It exists only to
attach the controlled package-grounding MCP server (see plugin.json) to the evaluated
run so the agent self-selects whether to retrieve curated grounding via the
get_package_context tool. The retrieval gate under test lives in the tool's
description (GROUNDING_GATE), not here. -->

# (no inline guidance)
