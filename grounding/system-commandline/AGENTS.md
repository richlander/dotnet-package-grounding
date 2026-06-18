# System.CommandLine (2.0 GA)

Guidance for **System.CommandLine 2.0** (stable GA). The 2.0 API differs from
`2.0.0-beta*` and from `McMaster.Extensions.CommandLineUtils`. Use when creating or
migrating a CLI app targeting System.CommandLine.

```xml
<PackageReference Include="System.CommandLine" Version="2.0.0" />
```

## Core types

| Concept        | Type / member |
| -------------- | ------------- |
| Root / sub     | `RootCommand`, `Command` (add via collection init or `command.Subcommands.Add`) |
| Option / arg   | `Option<T>`, `Argument<T>` (aliases are extra ctor args: `new Option<int>("--times","-t")`) |
| Handler        | `command.SetAction(parseResult => { ... })` |
| Read a value   | `parseResult.GetValue(option)` / `GetValue(argument)` |
| Run            | `rootCommand.Parse(args).Invoke()` |

```csharp
using System.CommandLine;
var nameArg = new Argument<string>("name");
var timesOpt = new Option<int>("--times", "-t") { DefaultValueFactory = _ => 1 };
var greet = new Command("greet", "Print a greeting.") { nameArg, timesOpt };
greet.SetAction(pr =>
{
    for (var i = 0; i < pr.GetValue(timesOpt); i++)
        Console.WriteLine($"Hello, {pr.GetValue(nameArg)}.");
    return 0;
});
return new RootCommand("Sample app") { greet }.Parse(args).Invoke();
```

## Migrate from `2.0.0-beta4`

| Beta4 | 2.0 GA |
| ----- | ------ |
| `AddOption` / `AddArgument` / `AddCommand` | collection init or `.Subcommands.Add` |
| `SetHandler(...)` | `SetAction(parseResult => ...)` |
| `context.ParseResult.GetValueForOption(o)` | `parseResult.GetValue(o)` |
| `IConsole` / `InvocationContext` | use `Console`; action receives `ParseResult` |
| `new Option<T>("--n","desc")` | `new Option<T>("--n") { Description = "desc" }` |

## Migrate from `McMaster.Extensions.CommandLineUtils`

| McMaster | System.CommandLine 2.0 |
| -------- | ---------------------- |
| `CommandLineApplication` / `app.Command(...)` | `RootCommand` / `new Command(...)` |
| `command.Argument` / `command.Option<T>` | `Argument<T>` / `Option<T>` |
| `option.HasValue()` / `ParsedValue` | `parseResult.GetValue(option)` |
| `OnExecute(() => 0)` / `app.Execute(args)` | `SetAction(pr => 0)` / `Parse(args).Invoke()` |
| `app.Out` / `app.Error` | write to `Console`; in tests use `Console.SetOut/SetError` |

## Gotchas
- Options/args are referenced by **identity** — keep the instance to pass to `GetValue`.
- Defaults use `DefaultValueFactory`, not a plain default parameter.
- There is no `IConsole` in GA; don't reintroduce it.
