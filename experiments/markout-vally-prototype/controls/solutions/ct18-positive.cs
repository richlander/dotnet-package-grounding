using Markout;

var pkg = new PackageReport
{
    Id = "Serilog",
    Version = "3.1.1",
    Downloads = 500_000_000,
    Dependencies = [new() { Name = "Serilog.Sinks.Console", Version = "5.0.0" }],
    Diagnostics = [new() { Level = "warning", Text = "transitive version conflict" }],
};

Console.WriteLine("=== QUIET ===");
MarkoutSerializer.Serialize(
    pkg,
    Console.Out,
    new MarkdownFormatter(),
    PackageReportContext.Default,
    new MarkoutWriterOptions { IncludeSections = [] });

Console.WriteLine("=== NORMAL ===");
MarkoutSerializer.Serialize(
    pkg,
    Console.Out,
    new MarkdownFormatter(),
    PackageReportContext.Default,
    new MarkoutWriterOptions { IncludeSections = ["Dependencies"] });

Console.WriteLine("=== DETAILED ===");
MarkoutSerializer.Serialize(
    pkg,
    Console.Out,
    new MarkdownFormatter(),
    PackageReportContext.Default,
    new MarkoutWriterOptions { IncludeSections = ["Dependencies", "Diagnostics"] });

[MarkoutSerializable(TitleProperty = nameof(Id))]
public sealed class PackageReport
{
    public string Id { get; init; } = "";
    public string Version { get; init; } = "";
    public long Downloads { get; init; }

    [MarkoutSection(Name = "Dependencies")]
    public List<Dependency> Dependencies { get; init; } = [];

    [MarkoutSection(Name = "Diagnostics")]
    public List<Diagnostic> Diagnostics { get; init; } = [];
}

[MarkoutSerializable]
public sealed class Dependency
{
    public string Name { get; init; } = "";
    public string Version { get; init; } = "";
}

[MarkoutSerializable]
public sealed class Diagnostic
{
    public string Level { get; init; } = "";
    public string Text { get; init; } = "";
}

[MarkoutContext(typeof(PackageReport))]
[MarkoutContext(typeof(Dependency))]
[MarkoutContext(typeof(Diagnostic))]
public partial class PackageReportContext : MarkoutSerializerContext;
