namespace Grounding.Codegen;

// Implements the gen-plugins command.
internal static class Codegen
{
    // Expand every grounding/**/plugin.json.in (__REPO_ROOT__) into plugin.json.
    public static int GenPlugins()
    {
        var root = RepoRoot.Find();
        if (root is null) { Console.Error.WriteLine("grounding: cannot locate repo root."); return 1; }

        var count = 0;
        foreach (var template in Directory
                     .EnumerateFiles(Path.Combine(root, "grounding"), "plugin.json.in", SearchOption.AllDirectories)
                     .OrderBy(p => p, StringComparer.Ordinal))
        {
            var outPath = template[..^3]; // strip ".in"
            var text = File.ReadAllText(template).Replace("__REPO_ROOT__", root);
            File.WriteAllText(outPath, text);
            Console.WriteLine($"generated {Rel(root, outPath)}");
            count++;
        }
        Console.WriteLine($"done: {count} plugin.json file(s) generated under {root}");
        return 0;
    }

    private static string Rel(string root, string path) =>
        Path.GetRelativePath(root, path);
}
