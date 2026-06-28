using Grounding.Json;

namespace Grounding.Analyze;

internal sealed partial class Cards
{
    private const string Dash = "\u2014";       // —
    private const string Times = "\u00d7";      // ×
    private const string Warn = " \u26a0\ufe0f"; // ⚠️

    public void ToolsCard(IReadOnlyList<string> files, int topn = 8)
    {
        foreach (var path in files)
        {
            var b = Behavior.Extract(path);
            var d = Loader.Parse(path);
            var model = d.Model ?? "?";
            var sn = (d.Verdicts is { Count: > 0 } ? d.Verdicts[0].SkillName : null) ?? "?";
            _o.WriteLine($"### Diagnostic {Dash} top tools, {sn} (`{model}`)\n");
            _o.WriteLine("_Out-of-sandbox programs the agent invoked via `bash`, ranked. "
                + "**Extra** = tools that merely happen to be in the environment "
                + "(decompilers, inspectors, self-installed global tools) — the contamination "
                + "we want gone from the baseline. **Shell-archaeology** = basic reverse-engineering "
                + "(`curl`, `find`, `strings`, running the artifact DLL, …). **Build** = expected SDK "
                + "calls. Grounded arms should show only Build._\n");
            _o.WriteLine("| Arm | Extra tools (count) | Shell-archaeology | Build/SDK |");
            _o.WriteLine("| --- | --- | --- | --- |");
            foreach (var (arm, _) in Metrics.Arms)
            {
                var t = b[arm].Tools;
                var buckets = new Dictionary<string, List<(string, int)>>
                {
                    ["extra"] = new(), ["shell"] = new(), ["build"] = new(),
                };
                foreach (var (k, v) in t.MostCommon())
                    buckets[Behavior.Classify(k)].Add((k, v));
                static string Disp(string k) => k.StartsWith("dll:") ? k[4..] : k;
                string Fmt(List<(string K, int V)> xs) =>
                    xs.Count == 0 ? Dash
                        : string.Join(", ", xs.Take(topn).Select(x => $"`{Disp(x.K)}`{Times}{x.V}"));
                var star = buckets["extra"].Count > 0 ? Warn : "";
                _o.WriteLine($"| {Behavior.ArmLabel(arm)}{star} | {Fmt(buckets["extra"])} | "
                    + $"{Fmt(buckets["shell"])} | {Fmt(buckets["build"])} |");
            }
            _o.WriteLine();
        }
    }

    public void WebCard(IReadOnlyList<string> files, int topn = 10)
    {
        foreach (var path in files)
        {
            var b = Behavior.Extract(path);
            var d = Loader.Parse(path);
            var model = d.Model ?? "?";
            var sn = (d.Verdicts is { Count: > 0 } ? d.Verdicts[0].SkillName : null) ?? "?";
            _o.WriteLine($"### Diagnostic {Dash} top web targets, {sn} (`{model}`)\n");
            _o.WriteLine("_What the agent reached for on the open web (`web_fetch` domains + URL/query "
                + "keywords). The reality a clean baseline must not need; grounded arms should be "
                + "empty. Keywords reveal what the model went looking for — note any that name a "
                + "grounding tool the model knows by reputation (e.g. `dotnet-inspect`)._\n");
            _o.WriteLine("| Arm | Web domains (count) | Top keywords |");
            _o.WriteLine("| --- | --- | --- |");
            foreach (var (arm, _) in Metrics.Arms)
            {
                var dom = b[arm].Web.MostCommon(topn);
                var kw = b[arm].Kw.MostCommon(topn);
                var fmtd = dom.Count == 0 ? Dash : string.Join(", ", dom.Select(x => $"`{x.Key}`{Times}{x.Count}"));
                var fmtk = kw.Count == 0 ? Dash : string.Join(", ", kw.Select(x => $"`{x.Key}`{Times}{x.Count}"));
                var star = dom.Count > 0 ? Warn : "";
                _o.WriteLine($"| {Behavior.ArmLabel(arm)}{star} | {fmtd} | {fmtk} |");
            }
            _o.WriteLine();
        }
    }
}
