var format = args.FirstOrDefault() ?? "markdown";
var title = "Build 42";
var components = new List<ComponentTiming>
{
    new("api", 120),
    new("worker", 85),
};
var failures = new List<BuildFailure>();
var knownFailure = new BuildFailure("worker", "timeout");

// TODO: Render one report model in the three modes described by the task.

public record ComponentTiming(string Name, int DurationMs);
public record BuildFailure(string Component, string Message);
