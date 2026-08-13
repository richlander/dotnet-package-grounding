var title = "Security Scan";
var includeDependencies = args.Contains("dependencies", StringComparer.OrdinalIgnoreCase);
var severities = new List<SeverityCount>
{
    new("Critical", 2),
    new("High", 5),
    new("Low", 11),
};
var dependencies = new Dependency(
    "api",
    [
        new("postgres", []),
        new("redis", []),
    ]);

// TODO: Render the severity breakdown and conditionally hidden dependency tree.

public record SeverityCount(string Name, int Count);
public record Dependency(string Name, List<Dependency> Children);
