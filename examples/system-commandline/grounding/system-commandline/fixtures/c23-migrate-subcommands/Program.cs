// TODO: see the task description.

using System.CommandLine;

var item = new Argument<int>("item");
var add = new Command("add", "Add an item");
add.AddArgument(item);
var verbose = new Option<bool>("--verbose", description: "Verbose output");
var root = new RootCommand("Item tool");
root.AddGlobalOption(verbose);
root.AddCommand(add);
add.SetHandler((int n) => Console.WriteLine($"added {n}"), item);
return await root.InvokeAsync(args);
