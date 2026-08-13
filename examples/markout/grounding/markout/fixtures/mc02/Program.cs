var format = args.FirstOrDefault() ?? "markdown";
var title = "Service Map";
var dependencies = new Dependency(
    "gateway",
    [
        new("orders", [new("postgres", [])]),
        new("identity", []),
    ]);

// TODO: Render the hierarchy through one report model in Markdown or plain text.

public record Dependency(string Name, List<Dependency> Children);
