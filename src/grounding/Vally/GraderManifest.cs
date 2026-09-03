using System.Text.Json;
using System.Text.Json.Serialization;

namespace Grounding.Vally;

public sealed class VallyGraderManifest
{
    [JsonPropertyName("schema")] public int Schema { get; set; }
    [JsonPropertyName("evalName")] public string? EvalName { get; set; }
    [JsonPropertyName("evalFile")] public string? EvalFile { get; set; }
    [JsonPropertyName("evalHash")] public string? EvalHash { get; set; }
    [JsonPropertyName("model")] public string? Model { get; set; }
    [JsonPropertyName("k")] public int K { get; set; }
    [JsonPropertyName("synthetic")] public bool Synthetic { get; set; }
    [JsonPropertyName("tasks")] public List<VallyGraderManifestTask>? Tasks { get; set; }
}

public sealed class VallyGraderManifestTask
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("graders")] public List<VallyGraderManifestGrader>? Graders { get; set; }
}

public sealed class VallyGraderManifestGrader
{
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("type")] public string? Type { get; set; }
}

internal static class VallyGraderManifestReader
{
    internal static readonly HashSet<string> DeterministicGraderTypes = new(StringComparer.Ordinal)
    {
        "completed",
        "run-command",
        "file-not-contains",
    };

    public static VallyGraderManifest Read(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"grader manifest not found: {path}");

        VallyGraderManifest? manifest;
        try
        {
            manifest = JsonSerializer.Deserialize(
                File.ReadAllText(path),
                VallyJsonContext.Default.VallyGraderManifest);
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException($"{path}: invalid JSON: {ex.Message}");
        }

        if (manifest is null ||
            manifest.Schema != 1 ||
            string.IsNullOrWhiteSpace(manifest.EvalName) ||
            string.IsNullOrWhiteSpace(manifest.EvalFile) ||
            string.IsNullOrWhiteSpace(manifest.EvalHash) ||
            string.IsNullOrWhiteSpace(manifest.Model) ||
            manifest.K <= 0 ||
            manifest.Tasks is not { Count: > 0 })
        {
            throw new InvalidDataException(
                $"{path}: expected grader manifest schema 1 with evalName, evalFile, evalHash, model, positive k, and tasks.");
        }

        if (Path.GetFileName(manifest.EvalFile) != manifest.EvalFile)
            throw new InvalidDataException($"{path}: evalFile must be a file name, not a path.");
        if (!IsSha256(manifest.EvalHash))
            throw new InvalidDataException($"{path}: evalHash must be a sha256: value with 64 hexadecimal digits.");

        var taskIds = new HashSet<string>(StringComparer.Ordinal);
        var taskNames = new HashSet<string>(StringComparer.Ordinal);
        foreach (var task in manifest.Tasks)
        {
            if (string.IsNullOrWhiteSpace(task.Id) ||
                string.IsNullOrWhiteSpace(task.Name) ||
                !taskIds.Add(task.Id) ||
                !taskNames.Add(task.Name))
            {
                throw new InvalidDataException($"{path}: task ids and stimulus names must be non-empty and unique.");
            }
            if (task.Graders is not { Count: > 0 })
                throw new InvalidDataException($"{path}: {task.Id} has no graders.");

            var graderNames = new HashSet<string>(StringComparer.Ordinal);
            foreach (var grader in task.Graders)
            {
                if (string.IsNullOrWhiteSpace(grader.Name) || !graderNames.Add(grader.Name))
                    throw new InvalidDataException($"{path}: {task.Id} grader names must be non-empty and unique.");
                if (string.IsNullOrWhiteSpace(grader.Type) ||
                    !DeterministicGraderTypes.Contains(grader.Type))
                {
                    throw new InvalidDataException(
                        $"{path}: {task.Id} grader '{grader.Name}' has unsupported type '{grader.Type ?? "missing"}'.");
                }
            }
            if (!task.Graders.Any(g => g.Name!.StartsWith("satisfies/", StringComparison.Ordinal)) ||
                !task.Graders.Any(g => g.Name!.StartsWith("delivers/", StringComparison.Ordinal)))
            {
                throw new InvalidDataException(
                    $"{path}: {task.Id} requires at least one satisfies/ and one delivers/ grader.");
            }
        }

        return manifest;
    }

    private static bool IsSha256(string value) =>
        value.Length == 71 &&
        value.StartsWith("sha256:", StringComparison.Ordinal) &&
        value.AsSpan(7).IndexOfAnyExcept("0123456789abcdef") < 0;
}
