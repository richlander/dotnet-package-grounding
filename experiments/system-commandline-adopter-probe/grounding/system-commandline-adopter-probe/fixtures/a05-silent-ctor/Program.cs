using System.CommandLine;

var output = new Option<string>("--output", "-o", "destination");
var root = new RootCommand("Pack files")
{
    output,
};
root.SetAction(parseResult =>
{
    Console.WriteLine($"out={parseResult.GetValue(output)}");
    return 0;
});
return root.Parse(args).Invoke();
