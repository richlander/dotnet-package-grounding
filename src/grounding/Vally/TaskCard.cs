using System.Globalization;
using System.Text.Json;
using Grounding.Analyze;

namespace Grounding.Vally;

internal sealed class VallyTaskCard
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    private readonly TextWriter _output;

    public VallyTaskCard(TextWriter output) => _output = output;

    public int Render(
        string runDirectory,
        string graderManifestPath,
        string baselineVariant,
        string groundedVariant,
        int? expectedRuns,
        string? expectedModel,
        bool noTitle)
    {
        try
        {
            var manifest = VallyGraderManifestReader.Read(graderManifestPath);
            ValidateCommandAssertions(manifest, expectedRuns, expectedModel);
            var baseline = ReadVariant(runDirectory, baselineVariant);
            var grounded = ReadVariant(runDirectory, groundedVariant);
            ValidateVariant(baselineVariant, baseline, manifest);
            ValidateVariant(groundedVariant, grounded, manifest);

            var rows = manifest.Tasks!
                .OrderBy(task => task.Name, StringComparer.Ordinal)
                .Select(task => Summarize(
                    task,
                    baselineVariant,
                    baseline.Where(r => r.Stimulus == task.Name).ToList(),
                    groundedVariant,
                    grounded.Where(r => r.Stimulus == task.Name).ToList()))
                .ToList();

            if (!noTitle)
                _output.WriteLine($"### Vally task quality card — `{baselineVariant}` vs `{groundedVariant}` · {manifest.Model} · k={manifest.K}\n");
            _output.WriteLine("| task | coverage | Delivered reliability | fidelity lift | do-no-harm | efficiency |");
            _output.WriteLine("|---|---|---:|---:|---:|---|");
            foreach (var row in rows)
            {
                _output.WriteLine(
                    $"| {Escape(row.Task)} | {row.Coverage} | " +
                    $"{row.Baseline.Delivered}/{row.Baseline.K} → {row.Grounded.Delivered}/{row.Grounded.K} ({Signed(row.ReliabilityDelta)}) | " +
                    $"{NullableSigned(row.FidelityLift)} | {row.Loss:0.000} | {Efficiency(row)} |");
            }
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"vally task-card: {ex.Message}");
            return 1;
        }
    }

    internal static TaskRow Summarize(
        VallyGraderManifestTask task,
        string baselineVariant,
        List<VallyTrialResult> baselineRecords,
        string groundedVariant,
        List<VallyTrialResult> groundedRecords)
    {
        if (baselineRecords.Count != groundedRecords.Count)
            throw new InvalidDataException(
                $"{task.Id}: {baselineVariant} has {baselineRecords.Count} trials but {groundedVariant} has {groundedRecords.Count}.");

        var baseline = SummarizeArm(task, baselineRecords);
        var grounded = SummarizeArm(task, groundedRecords);
        var coverage = baseline.Delivered > 0
            ? grounded.Delivered > 0 ? "both productive" : "baseline-only"
            : grounded.Delivered > 0 ? "grounded-only" : "neither";
        var reliabilityDelta = grounded.Yield - baseline.Yield;
        double? fidelityLift = baseline.Fidelity is { } bf && grounded.Fidelity is { } gf ? gf - bf : null;
        var loss = Math.Max(baseline.Yield - grounded.Yield, 0);

        return new TaskRow(
            task.Name!,
            coverage,
            baseline,
            grounded,
            reliabilityDelta,
            fidelityLift,
            loss,
            Ratio(grounded.MedianDeliveredIet, baseline.MedianDeliveredIet),
            Ratio(grounded.LevelizedIet, baseline.LevelizedIet),
            Ratio(grounded.MedianDeliveredDurationMs, baseline.MedianDeliveredDurationMs));
    }

    internal static ArmSummary SummarizeArm(
        VallyGraderManifestTask task,
        List<VallyTrialResult> records)
    {
        var outcomes = records.Select(record =>
        {
            var model = ModelOf(record);
            var usage = record.Trajectory?.Metrics?.TokenUsage
                ?? throw new InvalidDataException($"{record.Stimulus}: trial {record.TrialIndex} has no token metrics.");
            var iet = IetModels.For(model).Iet(
                usage.InputTokens!.Value,
                usage.CacheReadTokens!.Value,
                usage.OutputTokens!.Value);
            return new TrialOutcome(record, Classify(record, task), iet);
        }).ToList();

        var delivered = outcomes.Where(o => o.Grade == OutcomeGrade.Delivers).ToList();
        var working = outcomes.Where(o => o.Grade != OutcomeGrade.Fails).ToList();
        return new ArmSummary(
            outcomes.Count,
            outcomes.Count - working.Count,
            working.Count - delivered.Count,
            delivered.Count,
            (double)delivered.Count / outcomes.Count,
            working.Count == 0 ? null : (double)delivered.Count / working.Count,
            Median(delivered.Select(o => o.Iet)),
            delivered.Count == 0 ? null : outcomes.Sum(o => o.Iet) / delivered.Count,
            Median(delivered.Select(o => o.Record.DurationMs)));
    }

    internal static OutcomeGrade Classify(
        VallyTrialResult record,
        VallyGraderManifestTask task)
    {
        var details = record.GradeResult!.Details!;
        var satisfies = details.Where(r => r.Name?.StartsWith("satisfies/", StringComparison.Ordinal) == true).ToList();
        var delivers = details.Where(r => r.Name?.StartsWith("delivers/", StringComparison.Ordinal) == true).ToList();
        if (satisfies.Any(r => r.Passed != true))
            return OutcomeGrade.Fails;
        return delivers.All(r => r.Passed == true) ? OutcomeGrade.Delivers : OutcomeGrade.Satisfies;
    }

    internal static void ValidateVariant(
        string arm,
        List<VallyTrialResult> records,
        VallyGraderManifest manifest)
    {
        var tasks = manifest.Tasks!;
        var expectedNames = tasks.Select(task => task.Name!).ToHashSet(StringComparer.Ordinal);
        var actualNames = records.Select(record => record.Stimulus!).ToHashSet(StringComparer.Ordinal);
        var missing = expectedNames.Except(actualNames, StringComparer.Ordinal).OrderBy(name => name).ToList();
        var extra = actualNames.Except(expectedNames, StringComparer.Ordinal).OrderBy(name => name).ToList();
        if (missing.Count > 0 || extra.Count > 0)
        {
            throw new InvalidDataException(
                $"{arm}: task set mismatch; missing [{string.Join(", ", missing)}], extra [{string.Join(", ", extra)}].");
        }
        if (records.Count != tasks.Count * manifest.K)
        {
            throw new InvalidDataException(
                $"{arm}: expected {tasks.Count * manifest.K} trials, found {records.Count}.");
        }

        foreach (var task in tasks)
            ValidateArm(task, arm, records.Where(record => record.Stimulus == task.Name).ToList(), manifest);

        var configHashes = records
            .Select(record => record.Experiment?.ConfigHash)
            .Where(hash => hash is not null)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (configHashes.Count > 1)
            throw new InvalidDataException($"{arm}: inconsistent experiment configHash values.");
    }

    internal static void ValidateArm(
        VallyGraderManifestTask task,
        string arm,
        List<VallyTrialResult> records,
        VallyGraderManifest manifest)
    {
        if (records.Count != manifest.K)
            throw new InvalidDataException($"{task.Id}/{arm}: expected k={manifest.K}, found {records.Count}.");
        var indexes = records.Select(TrialIndexOf).ToList();
        if (indexes.Any(i => i is null) ||
            !indexes.Select(i => i!.Value).OrderBy(i => i).SequenceEqual(Enumerable.Range(0, manifest.K)))
            throw new InvalidDataException($"{task.Id}/{arm}: duplicate, missing, or noncontiguous trial indexes.");
        if (records.Any(r => r.TotalTrials is not null) &&
            records.Any(r => r.TotalTrials != manifest.K))
            throw new InvalidDataException($"{task.Id}/{arm}: totalTrials does not match manifest k={manifest.K}.");

        foreach (var record in records)
            ValidateRecord(record, task, arm, manifest);
    }

    internal static List<VallyTrialResult> ReadVariant(string runDirectory, string variant)
    {
        var path = Path.Combine(runDirectory, variant, "results.jsonl");
        if (!File.Exists(path))
            throw new FileNotFoundException($"variant results not found: {path}");

        var records = new List<VallyTrialResult>();
        var lineNumber = 0;
        foreach (var line in File.ReadLines(path))
        {
            lineNumber++;
            if (string.IsNullOrWhiteSpace(line)) continue;
            VallyTrialResult? record;
            try
            {
                record = JsonSerializer.Deserialize(line, VallyJsonContext.Default.VallyTrialResult);
            }
            catch (JsonException ex)
            {
                throw new InvalidDataException($"{path}:{lineNumber}: invalid JSON: {ex.Message}");
            }
            if (record?.Type == "trial-result")
            {
                if (!string.Equals(record.Variant, variant, StringComparison.Ordinal))
                    throw new InvalidDataException(
                        $"{path}:{lineNumber}: record variant '{record.Variant ?? "missing"}' does not match directory '{variant}'.");
                if (string.IsNullOrWhiteSpace(record.Stimulus))
                    throw new InvalidDataException($"{path}:{lineNumber}: trial-result has no stimulus.");
                records.Add(record);
            }
        }
        return records;
    }

    internal static void ValidateCommandAssertions(
        VallyGraderManifest manifest,
        int? expectedRuns,
        string? expectedModel)
    {
        if (expectedRuns is { } k && k != manifest.K)
            throw new InvalidDataException($"--runs {k} does not match grader manifest k={manifest.K}.");
        if (expectedModel is not null && expectedModel != manifest.Model)
        {
            throw new InvalidDataException(
                $"--model {expectedModel} does not match grader manifest model {manifest.Model}.");
        }
    }

    internal static void ValidateRecord(
        VallyTrialResult record,
        VallyGraderManifestTask task,
        string arm,
        VallyGraderManifest manifest)
    {
        var index = TrialIndexOf(record)
            ?? throw new InvalidDataException($"{task.Id}/{arm}: trial has no valid index.");
        var label = $"{task.Id}/{arm}/trial-{index}";

        if (record.TrialIndex is < 0)
            throw new InvalidDataException($"{label}: trialIndex must be non-negative.");
        if (!string.Equals(record.Variant, arm, StringComparison.Ordinal) ||
            !string.Equals(record.Stimulus, task.Name, StringComparison.Ordinal))
        {
            throw new InvalidDataException($"{label}: variant or stimulus mismatch.");
        }
        if (!string.Equals(record.Model, manifest.Model, StringComparison.Ordinal))
        {
            throw new InvalidDataException(
                $"{label}: expected model {manifest.Model}, found {record.Model ?? "missing"}.");
        }
        if (record.Trajectory?.Metadata?.Model is { } metadataModel &&
            !string.Equals(metadataModel, manifest.Model, StringComparison.Ordinal))
        {
            throw new InvalidDataException(
                $"{label}: trajectory model {metadataModel} does not match manifest model {manifest.Model}.");
        }
        if (record.TotalTrials is { } totalTrials && totalTrials != manifest.K)
            throw new InvalidDataException($"{label}: totalTrials {totalTrials} does not match manifest k={manifest.K}.");

        if (!manifest.Synthetic && string.IsNullOrWhiteSpace(record.ItemId))
            throw new InvalidDataException($"{label}: itemId is required by a non-synthetic manifest.");
        if (!manifest.Synthetic && string.IsNullOrWhiteSpace(record.EvalName))
            throw new InvalidDataException($"{label}: evalName is required.");
        if (!manifest.Synthetic && string.IsNullOrWhiteSpace(record.EvalFilePath))
            throw new InvalidDataException($"{label}: evalFilePath is required.");
        if (record.EvalName is not null &&
            !string.Equals(record.EvalName, manifest.EvalName, StringComparison.Ordinal))
        {
            throw new InvalidDataException(
                $"{label}: evalName '{record.EvalName}' does not match manifest '{manifest.EvalName}'.");
        }
        if (record.EvalFilePath is { } evalFilePath &&
            !string.Equals(Path.GetFileName(evalFilePath), manifest.EvalFile, StringComparison.Ordinal))
        {
            throw new InvalidDataException(
                $"{label}: evalFilePath file name does not match manifest evalFile {manifest.EvalFile}.");
        }

        if (record.ItemId is { } itemId)
        {
            var expectedSuffix = $"::{arm}::{manifest.Model}::{task.Name}::trial-{index}";
            if (!itemId.EndsWith(expectedSuffix, StringComparison.Ordinal))
                throw new InvalidDataException($"{label}: itemId identity mismatch.");
            var itemIndex = TrialIndexFromItemId(itemId);
            if (itemIndex != index)
                throw new InvalidDataException($"{label}: itemId trial index mismatch.");
        }

        if (record.Experiment is { } experiment)
            ValidateExperiment(experiment, arm, manifest, label);
        if (record.Repair is { } repair)
            ValidateRepair(record.ItemId, repair, task, arm, manifest, index, label);
        if (!manifest.Synthetic && record.Experiment is null && record.Repair is null)
            throw new InvalidDataException($"{label}: experiment or canonical repair metadata is required.");

        if (!string.Equals(record.Status, "success", StringComparison.Ordinal))
        {
            throw new InvalidDataException(
                $"{label}: execution status is '{record.Status ?? "missing"}'; infrastructure errors cannot be classified.");
        }
        if (!(record.DurationMs > 0) || double.IsInfinity(record.DurationMs) || double.IsNaN(record.DurationMs))
            throw new InvalidDataException($"{label}: invalid duration.");

        var usage = record.Trajectory?.Metrics?.TokenUsage
            ?? throw new InvalidDataException($"{label}: missing token metrics.");
        if (usage.InputTokens is null ||
            usage.OutputTokens is null ||
            usage.CacheReadTokens is null ||
            usage.InputTokens < 0 ||
            usage.OutputTokens < 0 ||
            usage.CacheReadTokens < 0)
        {
            throw new InvalidDataException($"{label}: invalid token metrics.");
        }

        ValidateGraders(record, task, label);
    }

    private static void ValidateExperiment(
        VallyExperimentMetadata experiment,
        string arm,
        VallyGraderManifest manifest,
        string label)
    {
        var expectedHash = manifest.EvalHash![7..23];
        if (!string.Equals(experiment.EvalHash, expectedHash, StringComparison.Ordinal) ||
            !string.Equals(experiment.Variant, arm, StringComparison.Ordinal))
        {
            throw new InvalidDataException($"{label}: experiment evalHash or variant mismatch.");
        }
        if (string.IsNullOrWhiteSpace(experiment.EvalFile) ||
            !string.Equals(Path.GetFileName(experiment.EvalFile), manifest.EvalFile, StringComparison.Ordinal))
        {
            throw new InvalidDataException($"{label}: experiment evalFile mismatch.");
        }
        if (string.IsNullOrWhiteSpace(experiment.ConfigHash) || !IsPersistedHash(experiment.ConfigHash))
            throw new InvalidDataException($"{label}: missing or malformed experiment configHash.");
    }

    private static void ValidateRepair(
        string? canonicalItemId,
        VallyRepairMetadata repair,
        VallyGraderManifestTask task,
        string arm,
        VallyGraderManifest manifest,
        int index,
        string label)
    {
        if (!string.Equals(repair.SourceVariant, "main", StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(canonicalItemId) ||
            string.IsNullOrWhiteSpace(repair.OriginalItemId) ||
            string.IsNullOrWhiteSpace(repair.RepairRun))
        {
            throw new InvalidDataException($"{label}: invalid canonical repair metadata.");
        }

        var canonicalSuffix = $"::{arm}::{manifest.Model}::{task.Name}::trial-{index}";
        var originalSuffix = $"::main::{manifest.Model}::{task.Name}::trial-{index}";
        if (!canonicalItemId.EndsWith(canonicalSuffix, StringComparison.Ordinal) ||
            !repair.OriginalItemId.EndsWith(originalSuffix, StringComparison.Ordinal))
        {
            throw new InvalidDataException($"{label}: canonical repair itemId identity mismatch.");
        }

        var canonicalEval = canonicalItemId[..^canonicalSuffix.Length];
        var originalEval = repair.OriginalItemId[..^originalSuffix.Length];
        if (!string.Equals(canonicalEval, originalEval, StringComparison.Ordinal))
            throw new InvalidDataException($"{label}: canonical repair eval identity mismatch.");
    }

    private static void ValidateGraders(
        VallyTrialResult record,
        VallyGraderManifestTask task,
        string label)
    {
        var details = record.GradeResult?.Details
            ?? throw new InvalidDataException($"{label}: missing grader details.");
        var expected = task.Graders!.ToDictionary(grader => grader.Name!, grader => grader.Type!, StringComparer.Ordinal);
        var actual = new Dictionary<string, VallyGradeResult>(StringComparer.Ordinal);
        foreach (var grader in details)
        {
            if (string.IsNullOrWhiteSpace(grader.Name) || !actual.TryAdd(grader.Name, grader))
                throw new InvalidDataException($"{label}: missing or duplicate grader name.");
            if (grader.Passed is null)
                throw new InvalidDataException($"{label}: grader '{grader.Name}' has no passed result.");
        }
        if (actual.Count != expected.Count)
            throw new InvalidDataException($"{label}: grader count mismatch.");
        foreach (var (name, type) in expected)
        {
            if (!actual.TryGetValue(name, out var grader) ||
                !string.Equals(grader.GraderType, type, StringComparison.Ordinal))
            {
                throw new InvalidDataException($"{label}: grader '{name}' is missing or type-mismatched.");
            }
        }

        var failedHarness = details.FirstOrDefault(grader =>
            grader.Name!.StartsWith("harness/", StringComparison.Ordinal) &&
            grader.Passed != true);
        if (failedHarness is not null)
            throw new InvalidDataException($"{label}: harness grader '{failedHarness.Name}' failed.");
    }

    internal static string ModelOf(VallyTrialResult record) =>
        record.Model ?? throw new InvalidDataException($"{record.Stimulus}: trial {record.TrialIndex} has no model.");

    internal static int? TrialIndexOf(VallyTrialResult record)
    {
        if (record.TrialIndex is { } index)
        {
            if (record.ItemId is { } itemId &&
                TrialIndexFromItemId(itemId) is { } itemIndex &&
                itemIndex != index)
            {
                throw new InvalidDataException(
                    $"{record.Stimulus}: trialIndex {index} does not match itemId trial-{itemIndex}.");
            }
            return index;
        }
        return TrialIndexFromItemId(record.ItemId);
    }

    private static int? TrialIndexFromItemId(string? itemId)
    {
        const string marker = "::trial-";
        var markerIndex = itemId?.LastIndexOf(marker, StringComparison.Ordinal) ?? -1;
        return markerIndex >= 0 &&
               int.TryParse(itemId![(markerIndex + marker.Length)..], NumberStyles.None, Inv, out var parsed)
            ? parsed
            : null;
    }

    private static bool IsPersistedHash(string value) =>
        value.Length == 16 &&
        value.AsSpan().IndexOfAnyExcept("0123456789abcdef") < 0;

    internal static double? Median(IEnumerable<double> values)
    {
        var sorted = values.OrderBy(v => v).ToList();
        if (sorted.Count == 0) return null;
        var middle = sorted.Count / 2;
        return sorted.Count % 2 == 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2.0;
    }

    internal static double? Ratio(double? numerator, double? denominator) =>
        numerator is { } n && denominator is > 0 ? n / denominator.Value : null;

    private static string Efficiency(TaskRow row) =>
        row.MedianDeliveredIetRatio is null
            ? "not comparable"
            : $"median-IET {Multiple(row.MedianDeliveredIetRatio)}; " +
              $"levelized-IET {Multiple(row.LevelizedIetRatio)}; " +
              $"median-duration {Multiple(row.MedianDeliveredDurationRatio)}";

    private static string Multiple(double? value) => value is { } v ? $"×{v.ToString("0.00", Inv)}" : "n/a";
    private static string Signed(double value) => (value >= 0 ? "+" : "") + value.ToString("0.000", Inv);
    private static string NullableSigned(double? value) => value is { } v ? Signed(v) : "n/a";
    private static string Escape(string value) => value.Replace("|", "\\|", StringComparison.Ordinal);

    internal enum OutcomeGrade { Fails, Satisfies, Delivers }
    internal sealed record TrialOutcome(VallyTrialResult Record, OutcomeGrade Grade, double Iet);
    internal sealed record ArmSummary(
        int K,
        int Fails,
        int Satisfies,
        int Delivered,
        double Yield,
        double? Fidelity,
        double? MedianDeliveredIet,
        double? LevelizedIet,
        double? MedianDeliveredDurationMs);
    internal sealed record TaskRow(
        string Task,
        string Coverage,
        ArmSummary Baseline,
        ArmSummary Grounded,
        double ReliabilityDelta,
        double? FidelityLift,
        double Loss,
        double? MedianDeliveredIetRatio,
        double? LevelizedIetRatio,
        double? MedianDeliveredDurationRatio);
}
