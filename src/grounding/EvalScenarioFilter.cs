namespace Grounding;

internal sealed class StagedEval : IDisposable
{
    public required string Root { get; init; }
    public required int Kept { get; init; }

    public void Dispose()
    {
        try { Directory.Delete(Root, recursive: true); }
        catch { /* Best-effort cleanup of a process-local temporary tree. */ }
    }
}

internal static class EvalScenarioFilter
{
    public static StagedEval? Stage(
        string sourceUnitDir,
        string unit,
        IReadOnlyList<string> keepTokens,
        string tempPrefix,
        out string? error)
    {
        error = null;
        var evalPath = Path.Combine(sourceUnitDir, "eval.yaml");
        if (!File.Exists(evalPath))
        {
            error = $"eval.yaml not found at {evalPath}.";
            return null;
        }

        var stagedRoot = Path.Combine(Path.GetTempPath(), $"{tempPrefix}-{Guid.NewGuid():N}");
        var stagedUnit = Path.Combine(stagedRoot, unit);
        Directory.CreateDirectory(stagedUnit);

        foreach (var file in Directory.EnumerateFiles(sourceUnitDir))
        {
            if (!Path.GetFileName(file).Equals("eval.yaml", StringComparison.OrdinalIgnoreCase))
                File.Copy(file, Path.Combine(stagedUnit, Path.GetFileName(file)));
        }
        foreach (var dir in Directory.EnumerateDirectories(sourceUnitDir))
            CopyDir(dir, Path.Combine(stagedUnit, Path.GetFileName(dir)));

        var filtered = Filter(File.ReadAllLines(evalPath), keepTokens, out var kept);
        if (kept == 0)
        {
            error = $"--scenarios matched no scenarios in {evalPath}.";
            try { Directory.Delete(stagedRoot, recursive: true); } catch { }
            return null;
        }

        File.WriteAllText(Path.Combine(stagedUnit, "eval.yaml"), filtered);
        return new StagedEval { Root = stagedRoot, Kept = kept };
    }

    // Scenario blocks are top-level `- name:` items under `scenarios:`. Preserve the header and
    // retain complete matching blocks so fixture paths and YAML structure remain unchanged.
    private static string Filter(string[] lines, IReadOnlyList<string> keepTokens, out int kept)
    {
        kept = 0;
        var header = new List<string>();
        var blocks = new List<(string Name, List<string> Body)>();
        List<string>? current = null;
        string? currentName = null;
        var itemIndent = -1;

        static bool IsItem(string line, out string name, out int indent)
        {
            name = "";
            var trimmed = line.TrimStart();
            indent = line.Length - trimmed.Length;
            if (!trimmed.StartsWith("- ")) return false;
            var afterDash = trimmed[2..].TrimStart();
            if (!afterDash.StartsWith("name:")) return false;
            name = afterDash["name:".Length..].Trim().Trim('"', '\'');
            return true;
        }

        foreach (var line in lines)
        {
            if (IsItem(line, out var name, out var indent) && (itemIndent < 0 || indent == itemIndent))
            {
                itemIndent = indent;
                if (current is not null) blocks.Add((currentName!, current));
                current = new List<string> { line };
                currentName = name;
            }
            else if (current is null)
            {
                header.Add(line);
            }
            else
            {
                current.Add(line);
            }
        }
        if (current is not null) blocks.Add((currentName!, current));

        var output = new System.Text.StringBuilder();
        foreach (var line in header) output.AppendLine(line);
        foreach (var (name, body) in blocks)
        {
            if (!keepTokens.Any(token =>
                    name.StartsWith(token, StringComparison.OrdinalIgnoreCase)
                    || name.Contains(token, StringComparison.OrdinalIgnoreCase)))
                continue;

            kept++;
            foreach (var line in body) output.AppendLine(line);
        }
        return output.ToString();
    }

    private static void CopyDir(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (var file in Directory.EnumerateFiles(source))
            File.Copy(file, Path.Combine(destination, Path.GetFileName(file)));
        foreach (var directory in Directory.EnumerateDirectories(source))
            CopyDir(directory, Path.Combine(destination, Path.GetFileName(directory)));
    }
}
