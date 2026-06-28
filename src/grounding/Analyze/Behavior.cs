using System.Text.Json;
using System.Text.RegularExpressions;
using Grounding.Json;

namespace Grounding.Analyze;

// Insertion-ordered counter that reproduces Python collections.Counter.most_common:
// count descending, ties broken by first-seen order.
internal sealed class Counter
{
    private readonly Dictionary<string, int> _counts = new();
    private readonly Dictionary<string, int> _order = new();
    private int _seq;

    public void Add(string key)
    {
        if (!_counts.ContainsKey(key)) { _counts[key] = 0; _order[key] = _seq++; }
        _counts[key]++;
    }

    public List<(string Key, int Count)> MostCommon(int? n = null)
    {
        var items = _counts
            .Select(kv => (kv.Key, kv.Value))
            .OrderByDescending(x => x.Value)
            .ThenBy(x => _order[x.Key])
            .ToList();
        return n is { } nn ? items.Take(nn).ToList() : items;
    }

    public bool Any => _counts.Count > 0;
}

internal sealed class ArmBehavior
{
    public Counter Tools = new();
    public Counter Web = new();
    public Counter Kw = new();
}

internal static partial class Behavior
{
    private static readonly HashSet<string> ExtraTools = new()
    {
        "dotnet-inspect", "ilspycmd", "dotnet-ildasm", "ildasm", "dotnet-depends",
        "dotnet-linq2db", "dotnet-script", "dotnet-repl",
    };
    private static readonly HashSet<string> ShellArch = new()
    {
        "curl", "wget", "find", "ls", "cat", "grep", "strings", "file", "jq",
        "head", "tail", "nm", "objdump", "unzip", "xxd", "zcat", "gunzip", "tree",
    };
    private static readonly HashSet<string> DropLead = new()
    {
        "cd", "sudo", "env", "rm", "mv", "cp", "mkdir", "echo", "true", "export",
        "set", "for", "do", "done", "if", "then", "fi", "#", "while", ":",
    };
    private static readonly HashSet<string> KwDrop = new()
    {
        "index", "json", "packages", "tree", "blob", "main", "master", "wiki",
    };

    [GeneratedRegex(@"<<-?\s*'?""?(\w+)'?""?.*?(?:\n|$).*?(?:^|\n)\s*\1\b",
        RegexOptions.Singleline | RegexOptions.Multiline)]
    private static partial Regex Heredoc();

    [GeneratedRegex(@"&&|\|\||;|\|")]
    private static partial Regex Segments();

    [GeneratedRegex(@"^https?://([^/]+)(/[^?#]*)?")]
    private static partial Regex Url();

    [GeneratedRegex(@"[A-Za-z][A-Za-z0-9.\-]{2,}")]
    private static partial Regex Word();

    private static string StripHeredocs(string cmd) => Heredoc().Replace(cmd, " <<heredoc>> ");

    public static List<string> LeadProgs(string cmd)
    {
        var outp = new List<string>();
        foreach (var part in Segments().Split(StripHeredocs(cmd)))
        {
            var toks = part.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (toks.Length == 0 || DropLead.Contains(toks[0])) continue;
            var p = toks[0];
            if (p == "dotnet" && toks.Length > 1)
            {
                if (toks[1] == "tool" && toks.Length > 2) p = "dotnet tool " + toks[2];
                else if (toks[1].EndsWith(".dll")) p = "dll:" + Path.GetFileName(toks[1]);
                else p = "dotnet " + toks[1];
            }
            outp.Add(p);
        }
        return outp;
    }

    public static Dictionary<string, ArmBehavior> Extract(string path)
    {
        var d = Loader.Parse(path);
        var scn = (d.Verdicts is { Count: > 0 } ? d.Verdicts[0].Scenarios : null) ?? new();
        var arms = new Dictionary<string, ArmBehavior>();
        foreach (var (arm, _) in Metrics.Arms)
        {
            var b = new ArmBehavior();
            foreach (var s in scn)
            {
                var ev = Loader.ArmOf(s, arm)?.Metrics?.Events ?? new();
                foreach (var e in ev)
                {
                    if (e.Type != "tool.execution_start") continue;
                    var name = e.Data?.ToolName ?? "";
                    var argsJson = e.Data?.Arguments ?? "{}";
                    var a = ParseArgs(argsJson);
                    if (name == "bash")
                    {
                        foreach (var p in LeadProgs(a.TryGetValue("command", out var c) ? c : ""))
                            b.Tools.Add(p);
                    }
                    else if (name == "web_fetch")
                    {
                        var m = Url().Match(a.TryGetValue("url", out var u) ? u : "");
                        if (m.Success)
                        {
                            b.Web.Add(m.Groups[1].Value);
                            foreach (Match w in Word().Matches(m.Groups[2].Value))
                            {
                                var seg = w.Value.ToLowerInvariant();
                                if (!KwDrop.Contains(seg)) b.Kw.Add(seg);
                            }
                        }
                    }
                    else if (name == "web_search")
                    {
                        var q = (a.TryGetValue("query", out var query) ? query : "").ToLowerInvariant();
                        foreach (Match w in Word().Matches(q)) b.Kw.Add(w.Value);
                    }
                }
            }
            arms[arm] = b;
        }
        return arms;
    }

    // Parse the tool-call arguments JSON string; on failure return empty (Python's try/except).
    private static Dictionary<string, string> ParseArgs(string json)
    {
        var outp = new Dictionary<string, string>();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return outp;
            foreach (var prop in doc.RootElement.EnumerateObject())
                if (prop.Value.ValueKind == JsonValueKind.String)
                    outp[prop.Name] = prop.Value.GetString() ?? "";
        }
        catch (JsonException) { }
        return outp;
    }

    public static string Classify(string k)
    {
        var @base = k.StartsWith("dll:") ? k[4..] : k;
        var stem = @base.Split(' ')[0];
        string[] decomp = { "ilspy", "ildasm", "inspect" };
        if (k.StartsWith("dotnet tool") || ExtraTools.Contains(stem)
            || k is "dotnet repl" or "dotnet script"
            || (k.StartsWith("dll:") && decomp.Any(x => @base.ToLowerInvariant().Contains(x))))
            return "extra";
        if (k.StartsWith("dll:")) return "shell";
        if (ShellArch.Contains(stem)) return "shell";
        if (k.StartsWith("dotnet ")) return "build";
        return "shell";
    }

    public static string ArmLabel(string key) => key switch
    {
        "baseline" => "Baseline",
        "skilledIsolated" => "AGENTS (isolated)",
        "skilledPlugin" => "AGENTS (grounding tool)",
        _ => key,
    };
}
