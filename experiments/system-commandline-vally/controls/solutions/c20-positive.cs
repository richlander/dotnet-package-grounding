using System.CommandLine;

var level = new Option<string>("--level");
level.AcceptOnlyFromAmong(StringComparer.OrdinalIgnoreCase, "debug", "info", "warn");
var root = new RootCommand { level };
root.SetAction(result =>
{
    Console.WriteLine($"level={result.GetValue(level)}");
    return 0;
});
return await root.Parse(args).InvokeAsync();
