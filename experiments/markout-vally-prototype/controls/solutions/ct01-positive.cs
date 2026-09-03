using Markout;

var report = new BuildReport
{
    Project = "Web.Api",
    Configuration = "Release",
    Warnings = 3,
    Errors = 0,
};

MarkoutSerializer.Serialize(report, Console.Out, BuildReportContext.Default);

[MarkoutSerializable(TitleProperty = nameof(Project))]
public sealed class BuildReport
{
    public string Project { get; init; } = "";
    public string Configuration { get; init; } = "";
    public int Warnings { get; init; }
    public int Errors { get; init; }
}

[MarkoutContext(typeof(BuildReport))]
public partial class BuildReportContext : MarkoutSerializerContext;
