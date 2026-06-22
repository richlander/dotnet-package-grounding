#!/usr/bin/env python3
"""Analyze markout / nugetfetch results.json, separating METRICS from SIGNALS.

The study draws on two epistemically different kinds of data, and the output
keeps them in distinct column groups so a claim is never confused with its
corroboration:

NORMATIVE METRICS -- the quantities we actually claim as value or harm. These
are what a conclusion ("grounding is cheaper / better") is allowed to rest on.

  qual   judge quality, overallScore 1-5 (rubric-weighted)   [value]
  func   functional assertions passed (build + file + run-output regex)  [value]
  tok    total token estimate (input+output)                  [harm: spend]
  cost   premium request multiplier (sum)                     [harm: spend]
  secs   wall seconds                                          [harm: latency]

INFORMATIVE SIGNALS -- corroborating behavioral data. A tool call or web fetch
is NOT itself a cost or a harm; on its own it adds nothing to the bill. Its
value is interpretive: many signal points together trace the narrative arc
(archaeology, cache-reflection, compile-retry loops) that EXPLAINS why the
normative metrics move. Token spend is a single point; signals give it a shape.

  web    web_fetch + web_search calls  (archaeology; grounded arms -> 0)
         a trailing 'Y' means a reject_tools assertion fired (web was used)
  tools  total tool calls
  di     dotnet-inspect CLI invocations (bash commands calling dotnet-inspect)
  mcp    NuGet MCP calls (nuget-* tools)
  cache  bash commands rummaging ~/.nuget/packages to reverse-engineer the API
  bash   bash calls (proxy for compile/run retry loops)

Usage:
  eng/analyze-6q.py data/markout-6q/*.json
  eng/analyze-6q.py .skill-validator-results/m6q-*/**/results.json
"""
import json, sys, glob

ARMS = [("baseline", "baseline"), ("skilledIsolated", "isolated"), ("skilledPlugin", "plugin")]


def count_tool_events(metrics):
    """Return (dotnet_inspect_calls, mcp_calls, cache_pokes) parsed from the event log.

    cache_pokes counts bash commands that rummage the local NuGet cache / installed DLL to
    reverse-engineer the API (ls/find/cat/reflection against ~/.nuget/packages). It is a
    distinct 'flailing' signal from web fetches: the agent recovering the API from the
    restored package on disk rather than from grounding.
    """
    di = mcp = cache = 0
    for e in metrics.get("events") or []:
        if e.get("type") != "tool.execution_start":
            continue
        data = e.get("data") or {}
        name = data.get("toolName", "")
        args = data.get("arguments", "") or ""
        if name == "bash" and ("dotnet-inspect" in args or "dotnet inspect" in args):
            di += 1
        if name == "bash" and (".nuget/packages" in args or ".nuget\\packages" in args
                               or "nuget/packages" in args):
            cache += 1
        if name.startswith("nuget-") or name.startswith("nuget_"):
            mcp += 1
    return di, mcp, cache


def arm_row(arm):
    if not arm:
        return None
    m = arm.get("metrics", {}) or {}
    jr = arm.get("judgeResult") or {}
    ar = m.get("assertionResults") or []
    func = [a for a in ar if a["assertion"].get("type") != 11]
    rej = [a for a in ar if a["assertion"].get("type") == 11]
    fp = sum(1 for a in func if a["passed"])
    web_used = any(not a["passed"] for a in rej)
    tb = m.get("toolCallBreakdown", {}) or {}
    web = tb.get("web_fetch", 0) + tb.get("web_search", 0)
    di, mcp, cache = count_tool_events(m)
    tok = (m.get("inputTokens", 0) or 0) + (m.get("outputTokens", 0) or 0)
    return dict(
        qual=jr.get("overallScore", "-"),
        func=f"{fp}/{len(func)}",
        web=web,
        web_flag="Y" if web_used else ".",
        tools=m.get("toolCallCount", "?"),
        di=di,
        mcp=mcp,
        cache=cache,
        bash=tb.get("bash", 0),
        tok=tok,
        cost=round(m.get("cost", 0) or 0, 1),
        secs=round((m.get("wallTimeMs", 0) or 0) / 1000),
    )


HDR = (f"{'scenario':28} | {'arm':8} | qual | func | {'tok':>6} | cost | secs "
       f"\u2016 web | tools | di | mcp | cache | bash")
GRP = (f"{'':28}   {'':8}   {'<<<<<<<<<< NORMATIVE METRICS':^34} "
       f"\u2016 {'INFORMATIVE SIGNALS >>>>>>>>>>':<29}")


def main(paths):
    files = []
    for p in paths:
        files.extend(glob.glob(p, recursive=True))
    for f in sorted(set(files)):
        try:
            d = json.load(open(f))
        except Exception as e:
            print(f"!! {f}: {e}"); continue
        for v in d.get("verdicts", []):
            print(f"\n===== {v.get('skillName','?')}   ({f})   model={d.get('model')} =====")
            print(GRP)
            print(HDR)
            print("-" * len(HDR))
            for sc in v.get("scenarios", []):
                name = sc["scenarioName"].split(":")[0]
                for key, label in ARMS:
                    r = arm_row(sc.get(key))
                    if not r:
                        continue
                    print(f"{name:28} | {label:8} | {str(r['qual']):>4} | {r['func']:>4} | "
                          f"{r['tok']:>6} | {str(r['cost']):>4} | {r['secs']:>4} "
                          f"\u2016 {str(r['web'])+r['web_flag']:>3} | {str(r['tools']):>5} | "
                          f"{r['di']:>2} | {r['mcp']:>3} | {r['cache']:>5} | {r['bash']:>4}")
                print("-" * len(HDR))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    main(sys.argv[1:])
