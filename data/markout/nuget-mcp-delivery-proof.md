# Proof: what the real NuGet MCP serves for Markout (Channels B vs C)

Direct `tools/call get_package_context` against the upstream `NuGet.Mcp.Server` (run via
`dnx NuGet.Mcp.Server --yes`), arguments `{packageName: Markout, packageVersion: 0.13.6,
solutionDirectory: <fixtures/report>}`. Probe: [`../../.tools/mcp_probe.py`] (ephemeral). The
server reads the restored package under `~/.nuget/packages/markout/0.13.6/`.

This is the mechanism behind Channels B and C: the upstream `get_package_context` **prefers
`AGENTS.md` when the package ships it, and falls back to the README otherwise.**

## Channel C — `AGENTS.md` present in the package

Returned content (resource):

```
uri:      nuget-context://Markout/0.13.6/AGENTS.md
mimeType: text/plain
text:     "---\nname: markout\ndescription: >- ...there is NO reflection fallback,
           so every Serialize call requires a MarkoutSerializerContext ..."
```

## Channel B — no `AGENTS.md` in the package (README fallback)

Same call, `AGENTS.md` removed from the restored package:

```
uri:      nuget-readme://Markout/0.13.6/README.md
mimeType: text/markdown
text:     "# Markout\n\n**Markup adds instructions to content. Markout removes structure
           from data.** ..."
```

The distinct URI scheme (`nuget-context://.../AGENTS.md` vs `nuget-readme://.../README.md`)
makes the server's selection unambiguous.
