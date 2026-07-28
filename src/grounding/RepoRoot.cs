namespace Grounding;

// Locates the INFRA repository root (holding the harness: examples/, eng/,
// .tools/) by walking up from the cwd, then the binary location. This is where
// skill-validator is found. The graded UNIT can live elsewhere (a target
// package repo) — see RunOptions.Root — so eval reads that repo's grounding/<unit>
// in place, with no packing or publishing required to iterate.
internal static class RepoRoot
{
    private static string? _cached;

    public static string? Find()
    {
        if (_cached is not null) return _cached;
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                if (Directory.Exists(Path.Combine(dir.FullName, "examples")) &&
                    Directory.Exists(Path.Combine(dir.FullName, "eng")))
                {
                    _cached = dir.FullName;
                    return _cached;
                }
                dir = dir.Parent;
            }
        }
        return null;
    }
}
