// TODO: see the task description.

using System.CommandLine;

var name = new Option<string>("--name", getDefaultValue: () => "world", description: "Who to greet") { IsRequired = true };
var root = new RootCommand("Greeter");
root.AddOption(name);
root.SetHandler((string n) => Console.WriteLine($"Hello, {n}!"), name);
return await root.InvokeAsync(args);
