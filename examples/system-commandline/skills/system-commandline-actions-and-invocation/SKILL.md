---
name: system-commandline-actions-and-invocation
version: 2.0.0
description: >-
  Use when the action itself is the hard part — especially a dedicated synchronous/asynchronous
  action class, Command.Action assignment, shared action bases, dependency-carrying actions,
  cancellation, Task<int>, exit codes, or splitting Parse(args) from Invoke/InvokeAsync.
  SetHandler and positional binding are gone. Declaring inputs and rejecting bad ones are separate
  topics.
---

# System.CommandLine: actions & invocation

Behavior attaches either as a small inline delegate with `SetAction`, or as a reusable
`SynchronousCommandLineAction` / `AsynchronousCommandLineAction` assigned to `Command.Action`.
You run the app by `Parse`-ing args into a `ParseResult`, then `Invoke`/`InvokeAsync`.
`SetHandler`, delegate parameter binding, and `IConsole` were removed at GA — do not use them.

> Do NOT `web_search` / `web_fetch` — nearly all samples show `SetHandler(...)` with
> positionally-bound parameters, which no longer exists.

## Required setup

`System.CommandLine` is **not** in the shared framework — add the package
(`dotnet package add <proj> System.CommandLine`), then `using System.CommandLine;`.

Every action reads inputs from the `ParseResult` **by option/argument instance**, so keep the exact
instances added to the command. Nothing is bound by parameter name or position.

## Dedicated action classes

Use a class when the command asks for a dedicated action, carries services/state, shares an action
base, or should keep command construction separate from execution. These action types live in
`System.CommandLine.Invocation`.

```csharp
using System.CommandLine;
using System.CommandLine.Invocation;

var input = new Argument<FileInfo>("input");
var format = new Option<string>("--format") { DefaultValueFactory = _ => "json" };
var export = new Command("export") { input, format };

// Pass the SAME symbol instances to the action, then assign the action object.
export.Action = new ExportAction(input, format, new ExportService());
var root = new RootCommand("Data tool") { export };
return await root.Parse(args).InvokeAsync();

internal sealed class ExportAction(
    Argument<FileInfo> input,
    Option<string> format,
    ExportService service) : AsynchronousCommandLineAction
{
    public override async Task<int> InvokeAsync(
        ParseResult parseResult,
        CancellationToken cancellationToken = default)
    {
        FileInfo file = parseResult.GetValue(input)!;
        string selectedFormat = parseResult.GetValue(format)!;
        await service.ExportAsync(file, selectedFormat, cancellationToken);
        return 0;
    }
}
```

- Override `int Invoke(ParseResult)` on `SynchronousCommandLineAction`.
- Override `Task<int> InvokeAsync(ParseResult, CancellationToken)` on
  `AsynchronousCommandLineAction`; pass that cancellation token through to cancellable work.
- If the requirement says **asynchronous action class**, inherit `AsynchronousCommandLineAction`
  even when today's body has no naturally asynchronous call. Do not silently substitute
  `SynchronousCommandLineAction` merely because the first implementation only prints output.
- Assign the object through `command.Action`. If the requirement is a dedicated action class, do
  **not** also wire the command with `SetAction`.
- Carry the exact `Option<T>` / `Argument<T>` objects into the action constructor and read them with
  `parseResult.GetValue(symbol)`. A same-named replacement object does not identify the parsed input.
- Give sibling commands their own symbol and action instances. An `add` option that is required and
  an `edit` option that is optional are different contracts even when both are named `--format`.

An abstract action base can carry inputs and dependencies shared by several leaf actions:

```csharp
internal abstract class ServiceActionBase(
    Option<string> logLevel,
    LoggingService logging) : AsynchronousCommandLineAction
{
    protected LoggingService Logging { get; } = logging;
    protected string LogLevel(ParseResult result) => result.GetValue(logLevel)!;
}
```

## Small inline actions

```csharp
// Sync: int is the process exit code (a void overload exists and implies 0).
command.SetAction(parseResult =>
{
    var name = parseResult.GetValue(nameOption)!;   // read by identity
    Console.WriteLine($"Hello {name}");
    return 0;
});

// Async: return Task<int> (or Task) and propagate cancellation.
command.SetAction(async (parseResult, cancellationToken) =>
{
    var url = parseResult.GetValue(urlOption)!;
    await DoWorkAsync(url, cancellationToken);
    return 0;
});
```

Use `SetAction` for genuinely local behavior. Do not expand a dedicated-action requirement into an
inline delegate merely because both forms can produce the same output.

## Parsing and running

```csharp
// One-shot:
return await root.Parse(args).InvokeAsync();     // sync equivalent: root.Parse(args).Invoke()

// Or inspect before invoking:
ParseResult result = root.Parse(args);
if (result.Errors.Count > 0)
{
    foreach (var e in result.Errors) Console.Error.WriteLine(e.Message);
    return 1;
}
return await result.InvokeAsync();
```

- `command.Parse(args)` returns a `ParseResult`; `Invoke()` / `InvokeAsync()` then run the matched
  command's action (and built-in `--help` / `--version` / error reporting).
- **Migration:** `command.Invoke(args)` / `InvokeAsync(args)` (arg-taking overloads) are gone — always
  `Parse(args)` first, then invoke the result.

## Errors & exit codes

- **User-input errors:** report with `result.AddError("...")` from a `CustomParser` or a validator on
  the option/argument. They land in `ParseResult.Errors`, are printed by the invoker, and produce a
  non-zero exit code automatically. Do not `throw` for bad input.
- **Action outcome:** return the exit code you want from `SetAction` or the action override.
- `ParseResult.Errors` is the list to check when you parse-then-decide manually.
