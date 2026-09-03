using System.Globalization;
using System.Text.Json;

namespace Grounding.Vally;

internal sealed class VallySkillCard
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    private readonly TextWriter _output;

    public VallySkillCard(TextWriter output) => _output = output;

    public int Render(
        string runDirectory,
        string applicabilityPath,
        string graderManifestPath,
        string baselineVariant,
        string groundedVariant,
        int? expectedRuns,
        string? expectedModel,
        IReadOnlyList<string> requestedSkills,
        bool noTotal,
        bool noTitle)
    {
        try
        {
            var applicability = ReadApplicability(applicabilityPath);
            var manifest = VallyGraderManifestReader.Read(graderManifestPath);
            VallyTaskCard.ValidateCommandAssertions(manifest, expectedRuns, expectedModel);
            var baseline = VallyTaskCard.ReadVariant(runDirectory, baselineVariant);
            var grounded = VallyTaskCard.ReadVariant(runDirectory, groundedVariant);
            VallyTaskCard.ValidateVariant(baselineVariant, baseline, manifest);
            VallyTaskCard.ValidateVariant(groundedVariant, grounded, manifest);

            var manifestTasks = manifest.Tasks!;
            var taskIds = manifestTasks.ToDictionary(task => task.Name!, task => task.Id!, StringComparer.Ordinal);
            var expectedTaskIds = applicability.Skills!.SelectMany(s => s.Tasks!).ToHashSet(StringComparer.Ordinal);
            var actualTaskIds = taskIds.Values.ToHashSet(StringComparer.Ordinal);
            var missingTaskIds = expectedTaskIds.Except(actualTaskIds, StringComparer.Ordinal).OrderBy(id => id).ToList();
            var unregisteredTaskIds = actualTaskIds.Except(expectedTaskIds, StringComparer.Ordinal).OrderBy(id => id).ToList();
            if (missingTaskIds.Count > 0 || unregisteredTaskIds.Count > 0)
                throw new InvalidDataException(
                    $"run is not the complete registered suite; missing: {string.Join(", ", missingTaskIds)}; " +
                    $"unregistered: {string.Join(", ", unregisteredTaskIds)}.");
            var summaries = manifestTasks.ToDictionary(
                task => task.Id!,
                task => VallyTaskCard.Summarize(
                    task,
                    baselineVariant,
                    baseline.Where(r => r.Stimulus == task.Name).ToList(),
                    groundedVariant,
                    grounded.Where(r => r.Stimulus == task.Name).ToList()),
                StringComparer.Ordinal);

            foreach (var record in grounded)
            {
                if (record.Trajectory?.Metrics?.SkillActivationBreakdown is null)
                    throw new InvalidDataException(
                        $"{record.Stimulus}: trial {record.TrialIndex} has no skillActivationBreakdown.");
            }

            var skills = SelectSkills(applicability, requestedSkills);
            if (!noTotal)
            {
                RenderSkill(
                    new VallyApplicabilitySkill
                    {
                        Name = "shelf-total",
                        ActivationNames = applicability.Skills!
                            .SelectMany(s => s.ActivationNames!)
                            .Distinct(StringComparer.Ordinal)
                            .ToList(),
                        Tasks = expectedTaskIds.OrderBy(id => id, StringComparer.Ordinal).ToList(),
                    },
                    applicability,
                    grounded,
                    taskIds,
                    summaries,
                    baselineVariant,
                    groundedVariant,
                    manifest.Model!,
                    manifest.K,
                    noTitle);
            }
            foreach (var skill in skills)
                RenderSkill(
                    skill,
                    applicability,
                    grounded,
                    taskIds,
                    summaries,
                    baselineVariant,
                    groundedVariant,
                    manifest.Model!,
                    manifest.K,
                    noTitle);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"vally skill-card: {ex.Message}");
            return 1;
        }
    }

    private void RenderSkill(
        VallyApplicabilitySkill skill,
        VallyApplicability applicability,
        List<VallyTrialResult> grounded,
        IReadOnlyDictionary<string, string> taskIds,
        IReadOnlyDictionary<string, VallyTaskCard.TaskRow> summaries,
        string baselineVariant,
        string groundedVariant,
        string models,
        int k,
        bool noTitle)
    {
        var name = skill.Name!;
        var targetIds = skill.Tasks!.ToHashSet(StringComparer.Ordinal);
        var targetTasks = summaries.Where(pair => targetIds.Contains(pair.Key)).Select(pair => pair.Value).ToList();
        if (targetTasks.Count == 0)
            throw new InvalidDataException($"{name}: no target tasks are present in this run.");

        var targetRecords = grounded.Where(r => targetIds.Contains(taskIds[r.Stimulus!])).ToList();
        var offTargetRecords = grounded.Where(r => !targetIds.Contains(taskIds[r.Stimulus!])).ToList();
        var targetPulls = targetRecords.Count(r => Activated(r, skill));
        var offTargetPulls = offTargetRecords.Count(r => Activated(r, skill));

        var both = targetTasks.Count(t => t.Coverage == "both productive");
        var groundedOnly = targetTasks.Count(t => t.Coverage == "grounded-only");
        var baselineOnly = targetTasks.Count(t => t.Coverage == "baseline-only");
        var neither = targetTasks.Count(t => t.Coverage == "neither");

        var baselineDelivered = targetTasks.Sum(t => t.Baseline.Delivered);
        var groundedDelivered = targetTasks.Sum(t => t.Grounded.Delivered);
        var baselineTrials = targetTasks.Sum(t => t.Baseline.K);
        var groundedTrials = targetTasks.Sum(t => t.Grounded.K);
        var reliabilityDelta = (double)groundedDelivered / groundedTrials - (double)baselineDelivered / baselineTrials;

        var baselineWorking = targetTasks.Sum(t => t.Baseline.Satisfies + t.Baseline.Delivered);
        var groundedWorking = targetTasks.Sum(t => t.Grounded.Satisfies + t.Grounded.Delivered);
        double? baselineFidelity = baselineWorking == 0 ? null : (double)baselineDelivered / baselineWorking;
        double? groundedFidelity = groundedWorking == 0 ? null : (double)groundedDelivered / groundedWorking;
        double? fidelityLift = baselineFidelity is { } bf && groundedFidelity is { } gf ? gf - bf : null;

        var suiteLoss = summaries.Values.Sum(t => t.Loss);
        var pulledTaskIds = grounded.Where(r => Activated(r, skill))
            .Select(r => taskIds[r.Stimulus!])
            .ToHashSet(StringComparer.Ordinal);
        var coincidentLoss = summaries.Where(pair => pulledTaskIds.Contains(pair.Key)).Sum(pair => pair.Value.Loss);
        var offTargetCoincidentLoss = summaries
            .Where(pair => pulledTaskIds.Contains(pair.Key) && !targetIds.Contains(pair.Key))
            .Sum(pair => pair.Value.Loss);

        var shared = targetTasks.Where(t => t.Baseline.Delivered > 0 && t.Grounded.Delivered > 0).ToList();
        var baselineTotalIet = shared.Sum(t => t.Baseline.MedianDeliveredIet!.Value);
        var groundedTotalIet = shared.Sum(t => t.Grounded.MedianDeliveredIet!.Value);
        double? totalIetRatio = shared.Count == 0 ? null : groundedTotalIet / baselineTotalIet;
        var levelizedGeo = GeoMean(shared.Select(t => t.LevelizedIetRatio));
        var durationGeo = GeoMean(shared.Select(t => t.MedianDeliveredDurationRatio));

        if (!noTitle)
        {
            var commit = applicability.Source?.Commit is { Length: > 0 } value ? $" · `{value[..Math.Min(7, value.Length)]}`" : "";
            var cardName = name == "shelf-total" ? "Shelf reference card" : $"Skill quality card — `{name}`";
            _output.WriteLine($"### {cardName} · {applicability.Suite} · `{baselineVariant}` vs `{groundedVariant}` · {models} · k={k}{commit}\n");
        }
        _output.WriteLine("| measure | result |");
        _output.WriteLine("|---|---|");
        _output.WriteLine($"| Retrieval | target pulls {Fraction(targetPulls, targetRecords.Count)}; off-target pulls {Fraction(offTargetPulls, offTargetRecords.Count)} |");
        _output.WriteLine($"| Coverage | both {both}; grounded-only {groundedOnly}; baseline-only {baselineOnly}; neither {neither} ({targetTasks.Count} target tasks) |");
        _output.WriteLine($"| Reliability | {baselineDelivered}/{baselineTrials} → {groundedDelivered}/{groundedTrials} ({Signed(reliabilityDelta)}) |");
        _output.WriteLine($"| Fidelity | {Fidelity(baselineDelivered, baselineWorking, baselineFidelity)} → {Fidelity(groundedDelivered, groundedWorking, groundedFidelity)} ({NullableSigned(fidelityLift)}) |");
        _output.WriteLine($"| Do no harm | suite loss mass {suiteLoss:0.000}; pull-coincident {coincidentLoss:0.000}; off-target pull-coincident {offTargetCoincidentLoss:0.000} |");
        _output.WriteLine($"| Efficiency | Total-IET {Multiple(totalIetRatio)} across {shared.Count} shared tasks; levelized geo {Multiple(levelizedGeo)}; duration geo {Multiple(durationGeo)} |");
        _output.WriteLine();
    }

    private static VallyApplicability ReadApplicability(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"applicability file not found: {path}");
        VallyApplicability? applicability;
        try
        {
            applicability = JsonSerializer.Deserialize(File.ReadAllText(path), VallyJsonContext.Default.VallyApplicability);
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException($"{path}: invalid JSON: {ex.Message}");
        }
        if (applicability is null || applicability.Schema != 1 || string.IsNullOrWhiteSpace(applicability.Suite))
            throw new InvalidDataException($"{path}: expected applicability schema 1 with a suite name.");
        if (applicability.Source is null ||
            string.IsNullOrWhiteSpace(applicability.Source.Repository) ||
            string.IsNullOrWhiteSpace(applicability.Source.Commit) ||
            string.IsNullOrWhiteSpace(applicability.Source.Path))
            throw new InvalidDataException($"{path}: source repository, commit, and path are required.");
        if (applicability.Skills is not { Count: > 0 })
            throw new InvalidDataException($"{path}: no skills defined.");

        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var skill in applicability.Skills)
        {
            if (string.IsNullOrWhiteSpace(skill.Name) || !names.Add(skill.Name))
                throw new InvalidDataException($"{path}: skill names must be non-empty and unique.");
            if (skill.Tasks is not { Count: > 0 } || skill.Tasks.Any(string.IsNullOrWhiteSpace))
                throw new InvalidDataException($"{path}: {skill.Name} has no valid target tasks.");
            if (skill.Tasks.Distinct(StringComparer.Ordinal).Count() != skill.Tasks.Count)
                throw new InvalidDataException($"{path}: {skill.Name} has duplicate target tasks.");
            skill.ActivationNames ??= new List<string> { skill.Name };
            if (skill.ActivationNames.Count == 0 || skill.ActivationNames.Any(string.IsNullOrWhiteSpace))
                throw new InvalidDataException($"{path}: {skill.Name} has no valid activation names.");
        }
        return applicability;
    }

    private static IReadOnlyList<VallyApplicabilitySkill> SelectSkills(
        VallyApplicability applicability,
        IReadOnlyList<string> requested)
    {
        if (requested.Count == 0) return applicability.Skills!;
        var byName = applicability.Skills!.ToDictionary(s => s.Name!, StringComparer.Ordinal);
        var selected = new List<VallyApplicabilitySkill>();
        foreach (var name in requested.Distinct(StringComparer.Ordinal))
        {
            if (!byName.TryGetValue(name, out var skill))
                throw new InvalidDataException($"requested skill '{name}' is not in the applicability file.");
            selected.Add(skill);
        }
        return selected;
    }

    private static bool Activated(VallyTrialResult record, VallyApplicabilitySkill skill)
    {
        var breakdown = record.Trajectory!.Metrics!.SkillActivationBreakdown!;
        return skill.ActivationNames!.Any(name => breakdown.TryGetValue(name, out var count) && count > 0);
    }

    private static double? GeoMean(IEnumerable<double?> values)
    {
        var present = values.ToList();
        return present.Count == 0 || present.Any(v => v is not > 0)
            ? null
            : Math.Exp(present.Average(v => Math.Log(v!.Value)));
    }

    private static string Fraction(int value, int total) =>
        total == 0 ? "n/a (no trials)" : $"{value}/{total} ({((double)value / total * 100).ToString("0.0", Inv)}%)";
    private static string Fidelity(int delivered, int working, double? value) =>
        value is null ? "n/a" : $"{delivered}/{working} ({(value.Value * 100).ToString("0.0", Inv)}%)";
    private static string Multiple(double? value) => value is { } v ? $"×{v.ToString("0.00", Inv)}" : "n/a";
    private static string Signed(double value) => (value >= 0 ? "+" : "") + value.ToString("0.000", Inv);
    private static string NullableSigned(double? value) => value is { } v ? Signed(v) : "n/a";
}
