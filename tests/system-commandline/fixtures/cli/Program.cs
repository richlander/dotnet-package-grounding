using System.CommandLine;

var rootCommand = new RootCommand("myapp - a small sample CLI");

var greetCommand = new Command("greet", "Print a greeting.");

var nameOption = new Option<string>("--name")
{
    Description = "Who to greet.",
    DefaultValueFactory = _ => "world",
};
greetCommand.Options.Add(nameOption);

greetCommand.SetAction(parseResult =>
{
    Console.WriteLine($"Hello, {parseResult.GetValue(nameOption)}.");
    return 0;
});

rootCommand.Subcommands.Add(greetCommand);

return rootCommand.Parse(args).Invoke();
