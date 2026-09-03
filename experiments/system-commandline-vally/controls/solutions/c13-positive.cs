using System.CommandLine;

var name = new Option<string>("--name") { DefaultValueFactory = _ => "world" };
var root = new RootCommand("Greeter");
root.Options.Add(name);
root.SetAction(result =>
{
    Console.WriteLine($"Hello, {result.GetValue(name)}!");
    return 0;
});
return await root.Parse(args).InvokeAsync();
