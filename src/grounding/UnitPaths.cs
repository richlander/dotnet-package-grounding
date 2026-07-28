namespace Grounding;

// Where a unit lives.
//
// A unit always has the package-repo shape: skills/ beside grounding/<unit>/. In a target
// package repo that shape IS the repo root. In this repo every unit is a proxy for one:
//
//   examples/<package>/     canonical shelf for a real package — copies verbatim into its repo
//   experiments/<unit>/     delivery-channel and variant arms, which ship from nowhere
//
// So `grounding/` means the same thing everywhere — the eval bundle — and `skills/` always
// sits beside it. Resolving the unit root first lets every caller share one code path.
internal static class UnitPaths
{
    // Searched in order; the repo root itself is the fallback (a target package repo).
    private static readonly string[] Areas = { "examples", "experiments" };

    // The root holding skills/ + grounding/<unit> for this unit, or null if there is none.
    public static string? FindRoot(string root, string unit)
    {
        foreach (var area in Areas)
        {
            var candidate = Path.Combine(root, area, unit);
            if (Directory.Exists(Path.Combine(candidate, "grounding", unit))) return candidate;
        }
        return Directory.Exists(Path.Combine(root, "grounding", unit)) ? root : null;
    }

    // The unit's eval bundle: <unit-root>/grounding/<unit>. Falls back to the classic
    // <root>/grounding/<unit> so callers can still build a path for a unit that is absent.
    public static string Dir(string root, string unit) =>
        Path.Combine(FindRoot(root, unit) ?? root, "grounding", unit);

    // Every unit root in a repo, for callers that enumerate rather than look up.
    public static IEnumerable<string> EnumerateRoots(string root)
    {
        foreach (var area in Areas)
        {
            var areaDir = Path.Combine(root, area);
            if (!Directory.Exists(areaDir)) continue;
            foreach (var unitRoot in Directory.EnumerateDirectories(areaDir).OrderBy(x => x, StringComparer.Ordinal))
                yield return unitRoot;
        }
        if (Directory.Exists(Path.Combine(root, "grounding"))) yield return root;
    }
}
