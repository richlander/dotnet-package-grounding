using System.Text;

namespace Grounding.Run;

// Carries a unit's name/description (from meta.yaml) and renders the transient
// SKILL.md wrapper the skill-validator harness consumes for the readme/none arms.
// The grounded arm feeds an authored skills/<unit>/SKILL.md verbatim instead.
internal sealed class SkillDoc
{
    public string? Name;
    public string? Description;

    private const string GeneratedMarker =
        "<!-- Transient grounding wrapper (SKILL.md or .agent.md) synthesized by the harness at eval time. Do not edit or commit. -->";

    // Build a doc from meta.yaml. The graded artifact is skills/<unit>/SKILL.md; here we
    // only need name/description for the baseline/readme wrapper.
    public static SkillDoc FromMeta(string? metaPath, string unit)
    {
        var doc = new SkillDoc { Name = unit };
        if (metaPath is not null && File.Exists(metaPath))
        {
            var meta = File.ReadAllText(metaPath);
            doc.Name = ExtractScalar(meta, "name") ?? unit;
            doc.Description = ExtractScalar(meta, "description");
        }
        return doc;
    }

    // Read a scalar `key:` value, folding block scalars (>-, >, |, |-) into one
    // space-joined line, matching the original awk extractor.
    private static string? ExtractScalar(string yaml, string key)
    {
        var lines = yaml.Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            if (!lines[i].StartsWith(key + ":")) continue;
            var val = lines[i][(key.Length + 1)..].Trim();
            if (val is ">-" or ">" or "|" or "|-")
            {
                var parts = new List<string>();
                for (var j = i + 1; j < lines.Length; j++)
                {
                    if (lines[j].Length > 0 && !char.IsWhiteSpace(lines[j][0])) break;
                    parts.Add(lines[j].Trim());
                }
                return string.Join(" ", parts).Trim();
            }
            return val;
        }
        return null;
    }

    public string Render(string body)
    {
        var esc = (Description ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
        var sb = new StringBuilder();
        sb.Append("---\n");
        sb.Append("name: ").Append(Name ?? "").Append('\n');
        sb.Append("description: \"").Append(esc).Append("\"\n");
        sb.Append("---\n\n");
        sb.Append(GeneratedMarker).Append("\n\n");
        sb.Append(body);
        return sb.ToString();
    }

}
