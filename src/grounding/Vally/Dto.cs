using System.Text.Json.Serialization;

namespace Grounding.Vally;

public sealed class VallyTrialResult
{
    [JsonPropertyName("type")] public string? Type { get; set; }
    [JsonPropertyName("variant")] public string? Variant { get; set; }
    [JsonPropertyName("stimulus")] public string? Stimulus { get; set; }
    [JsonPropertyName("model")] public string? Model { get; set; }
    [JsonPropertyName("itemId")] public string? ItemId { get; set; }
    [JsonPropertyName("trialIndex")] public int? TrialIndex { get; set; }
    [JsonPropertyName("totalTrials")] public int? TotalTrials { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("evalName")] public string? EvalName { get; set; }
    [JsonPropertyName("evalFilePath")] public string? EvalFilePath { get; set; }
    [JsonPropertyName("experiment")] public VallyExperimentMetadata? Experiment { get; set; }
    [JsonPropertyName("repair")] public VallyRepairMetadata? Repair { get; set; }
    [JsonPropertyName("durationMs")] public double DurationMs { get; set; }
    [JsonPropertyName("gradeResult")] public VallyGradeResult? GradeResult { get; set; }
    [JsonPropertyName("trajectory")] public VallyTrajectory? Trajectory { get; set; }
}

public sealed class VallyGradeResult
{
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("graderType")] public string? GraderType { get; set; }
    [JsonPropertyName("passed")] public bool? Passed { get; set; }
    [JsonPropertyName("details")] public List<VallyGradeResult>? Details { get; set; }
}

public sealed class VallyExperimentMetadata
{
    [JsonPropertyName("variant")] public string? Variant { get; set; }
    [JsonPropertyName("evalFile")] public string? EvalFile { get; set; }
    [JsonPropertyName("evalHash")] public string? EvalHash { get; set; }
    [JsonPropertyName("configHash")] public string? ConfigHash { get; set; }
}

public sealed class VallyRepairMetadata
{
    [JsonPropertyName("sourceVariant")] public string? SourceVariant { get; set; }
    [JsonPropertyName("originalItemId")] public string? OriginalItemId { get; set; }
    [JsonPropertyName("repairRun")] public string? RepairRun { get; set; }
}

public sealed class VallyTrajectory
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("metrics")] public VallyTrajectoryMetrics? Metrics { get; set; }
    [JsonPropertyName("metadata")] public VallyTrajectoryMetadata? Metadata { get; set; }
}

public sealed class VallyTrajectoryMetrics
{
    [JsonPropertyName("tokenUsage")] public VallyTokenUsage? TokenUsage { get; set; }
    [JsonPropertyName("skillActivationBreakdown")] public Dictionary<string, int>? SkillActivationBreakdown { get; set; }
}

public sealed class VallyTokenUsage
{
    [JsonPropertyName("inputTokens")] public long? InputTokens { get; set; }
    [JsonPropertyName("outputTokens")] public long? OutputTokens { get; set; }
    [JsonPropertyName("cacheReadTokens")] public long? CacheReadTokens { get; set; }
}

public sealed class VallyTrajectoryMetadata
{
    [JsonPropertyName("model")] public string? Model { get; set; }
}

public sealed class VallyApplicability
{
    [JsonPropertyName("schema")] public int Schema { get; set; }
    [JsonPropertyName("suite")] public string? Suite { get; set; }
    [JsonPropertyName("source")] public VallyApplicabilitySource? Source { get; set; }
    [JsonPropertyName("skills")] public List<VallyApplicabilitySkill>? Skills { get; set; }
}

public sealed class VallyApplicabilitySource
{
    [JsonPropertyName("repository")] public string? Repository { get; set; }
    [JsonPropertyName("commit")] public string? Commit { get; set; }
    [JsonPropertyName("path")] public string? Path { get; set; }
}

public sealed class VallyApplicabilitySkill
{
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("activationNames")] public List<string>? ActivationNames { get; set; }
    [JsonPropertyName("tasks")] public List<string>? Tasks { get; set; }
}

[JsonSerializable(typeof(VallyGraderManifest))]
[JsonSerializable(typeof(VallyTrialResult))]
[JsonSerializable(typeof(VallyApplicability))]
public sealed partial class VallyJsonContext : JsonSerializerContext;
