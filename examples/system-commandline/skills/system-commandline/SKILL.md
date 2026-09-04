---
name: system-commandline
version: 2.0.0
description: >-
  Use when building or modifying a .NET command-line app with System.CommandLine (RootCommand,
  Command, Option<T>, Argument<T>) on the current GA / 2.x–3.x API. This library had a large breaking
  redesign at 2.0 GA, so training data and web snippets are FULL of the removed beta stack
  (SetHandler, AddOption, BinderBase, IConsole). The #1 silent trap: the Option/Argument constructor's
  2nd positional argument is an ALIAS, not a description. Covers the small core shape. Pull
  actions/invocation for dedicated Command.Action classes or cancellation; options/arguments for
  HelpName, completion, stable case-insensitivity, custom parsing, or cross-option validators;
  beta migration, subcommands/help, and 3.x additions are separate. Don't web-search this API.
---

# System.CommandLine — parse & dispatch a .NET CLI (current API)

`System.CommandLine` (namespace `System.CommandLine`) parses arguments into a command tree and runs
an action. The 2.0 GA redesign **removed** the old invocation/binding stack, so most remembered
snippets do not compile. Pin the current shapes below.

> **Use the System.CommandLine skills, not the web.** Do NOT `web_search` / `web_fetch` for
> System.CommandLine usage — the web is dominated by the pre-GA beta API (`SetHandler`, `AddOption`,
> `AddCommand`, `BinderBase<T>`, `IConsole`, `getDefaultValue:` ctor args) that **no longer exists**.
> These skills are the current, authoritative API. This skill covers the core pattern; beta→GA
> migration, options/arguments in depth, actions/invocation, subcommands/help, and 3.x additions are
> covered separately.

If the task asks for a **dedicated action class**, do not substitute an inline `SetAction` delegate:
use the actions/invocation skill for `SynchronousCommandLineAction`,
`AsynchronousCommandLineAction`, and `command.Action`. If the task coordinates defaults,
completion, allowed values, or explicit presence across options, use the options/arguments skill;
those rules must run before the action.

## Composite commands: finish the input contract before assigning the action

A dedicated action does not replace parser configuration. For each command, finish its option
contract first:

```csharp
using System.CommandLine;
using System.CommandLine.Invocation;

string[] knownTypes = ["openai", "azure", "ollama"];
var type = new Option<string[]>("--type")
{
    Required = true,
    Arity = ArgumentArity.OneOrMore,
    HelpName = string.Join("|", knownTypes),
    AllowMultipleArgumentsPerToken = true,
};
type.CompletionSources.Add(knownTypes); // 2.0.11 takes the strings directly
type.Validators.Add(result =>
{
    foreach (string value in result.GetValueOrDefault<string[]>() ?? [])
        if (!knownTypes.Any(k => k.Equals(value, StringComparison.OrdinalIgnoreCase)))
            result.AddError($"Unknown type '{value}'.");
});

var authType = new Option<string>("--auth-type") { DefaultValueFactory = _ => "device" };
var authId = new Option<string?>("--auth-id");
var command = new Command("add") { type, authType, authId };
command.Validators.Add(result =>
{
    bool hasType = result.GetResult(authType)?.Implicit == false;
    bool hasId = result.GetResult(authId)?.Implicit == false;
    if (hasType != hasId) result.AddError("Supply both authentication settings or neither.");
});

command.Action = new AddAction(type, authType, authId);

internal sealed class AddAction(
    Option<string[]> type,
    Option<string> authType,
    Option<string?> authId) : AsynchronousCommandLineAction
{
    public override Task<int> InvokeAsync(
        ParseResult parseResult,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        string[] types = parseResult.GetValue(type) ?? [];
        string selectedAuthType = parseResult.GetValue(authType)!;
        string? id = parseResult.GetValue(authId);
        string auth = id is null ? "anonymous" : $"{selectedAuthType}:{id}";
        Console.WriteLine($"type={string.Join(",", types)};auth={auth}");
        return Task.FromResult(0);
    }
}
```

For a finite **case-sensitive** set on either 2.x or 3.x, prefer the package-owned parser rule:
`option.AcceptOnlyFromAmong("dev", "prod")`. For case-insensitive matching, pull the
3.x-additions skill when targeting 3.x; only stable 2.x needs the validator fallback shown above.
Never normalize by rewriting raw `args`.

A rule spanning options belongs on `command.Validators`, not inside the action, so invalid input
prevents invocation. Give sibling commands separate option and action instances when their
required/default/arity contracts differ. If the requirement says asynchronous action, inherit
`AsynchronousCommandLineAction` even when the initial body has no naturally asynchronous operation.

For 2.0.11 completion, copy `option.CompletionSources.Add(knownValues)` exactly. The collection takes
the strings directly; do **not** invent a `CompletionSource.ForValues(...)` wrapper and then remove
completion when that obsolete shape fails. Likewise, do not remove an option's parser default to make
an all-or-none check easier: keep the contract and use `GetResult(...).Implicit` for explicit presence.

## The core pattern (current API)

```csharp
using System.CommandLine;

// 1. Declare options/arguments. KEEP the instances — you read values back by identity.
var nameOption = new Option<string>("--name")            // "--name" is the name; extra strings are ALIASES
{
    Description = "Who to greet",                        // description is a PROPERTY, not a ctor arg
    Required = true,
};
nameOption.Aliases.Add("-n");
var countOption = new Option<int>("--count") { DefaultValueFactory = _ => 1 };

// 2. Build the command tree.
var root = new RootCommand("Greeter sample");
root.Options.Add(nameOption);
root.Options.Add(countOption);

// 3. Wire behavior with SetAction; read parsed values from the ParseResult by instance.
root.SetAction(parseResult =>
{
    string name = parseResult.GetValue(nameOption)!;
    int count = parseResult.GetValue(countOption);
    for (int i = 0; i < count; i++) Console.WriteLine($"Hello, {name}!");
    return 0;                                            // exit code
});

// 4. Parse then invoke.
return await root.Parse(args).InvokeAsync();
```

## Gotchas (compile-clean but wrong, or removed-API)

- **`new Option<T>("--name", "description")` is WRONG.** The 2nd positional arg is an **alias**, so the
  description becomes a bogus alias and the help text is lost. Use `new Option<T>("--name") {
  Description = "..." }`; pass real aliases as extra strings (`new Option<T>("--name", "-n")`) or via
  `.Aliases.Add(...)`. Same for `Argument<T>`.
- **Read values by identity.** `parseResult.GetValue(theOptionInstance)` — keep the exact instance you
  added. There is no delegate-parameter binding anymore.
- **`SetHandler` is gone.** Use `SetAction(parseResult => ...)` (sync) or
  `SetAction(async (parseResult, ct) => ...)` (async).
- **`AddOption` / `AddArgument` / `AddCommand` are gone.** Use the `.Options` / `.Arguments` /
  `.Subcommands` collections: `root.Options.Add(o)`, `cmd.Subcommands.Add(sub)`.
- **`Required`, not `IsRequired`.** Default values are `DefaultValueFactory = _ => v`, not
  `getDefaultValue:` / `SetDefaultValue(...)`.
- **`IConsole` / `BinderBase<T>` / `HelpBuilder` are gone.** Use `Console` directly; customize help via
  a `HelpAction` (help customization is covered separately).
