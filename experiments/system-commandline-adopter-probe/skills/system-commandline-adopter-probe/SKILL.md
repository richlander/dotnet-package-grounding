---
name: system-commandline-adopter-probe
version: 2.0.0
description: >-
  Use when building or modifying a .NET command-line app with System.CommandLine (RootCommand,
  Command, Option<T>, Argument<T>) on the current GA / 2.x–3.x API. This library had a large breaking
  redesign at 2.0 GA, so training data and web snippets are FULL of the removed beta stack
  (SetHandler, AddOption, BinderBase, IConsole). The #1 silent trap: the Option/Argument constructor's
  2nd positional argument is an ALIAS, not a description. Covers the core shapes: declaring inputs,
  building the command tree, SetAction, and reading values by identity. beta-to-GA migration,
  options/arguments in depth, actions/invocation, subcommands/help, and 3.x additions are covered
  separately. Don't web-search this API — the current idioms are in the System.CommandLine skills.
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
