using Markout;

var report = new DependencyTree
{
    Project = "MyApp",
    Root = new TreeNode("MyApp",
    [
        new TreeNode("Serilog", [new TreeNode("Serilog.Sinks.Console")]) { Badge = "✓" },
        new TreeNode("Polly") { Badge = "✓" },
    ]),
};

MarkoutSerializer.Serialize(
    report,
    Console.Out,
    new UnicodeFormatter(),
    DependencyTreeContext.Default);

[MarkoutSerializable(TitleProperty = nameof(Project))]
public sealed class DependencyTree
{
    public string Project { get; init; } = "";

    [MarkoutIgnoreInTable]
    public TreeNode Root { get; init; } = null!;
}

[MarkoutContext(typeof(DependencyTree))]
public partial class DependencyTreeContext : MarkoutSerializerContext;
