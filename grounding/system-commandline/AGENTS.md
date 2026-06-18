# System.CommandLine 3.x

Guidance for **System.CommandLine 3.x**, the current major line. Use when creating,
updating, or migrating a .NET CLI that uses System.CommandLine.

```xml
<!-- 3.0 has no GA yet; this is the latest 3.x preview -->
<PackageReference Include="System.CommandLine" Version="3.0.0-preview.5.26302.115" />
```

3.0 ships `net10.0` + `netstandard2.0`. The in-box `net8.0` lib from 2.x is gone, so
net8/net9 apps now bind the `netstandard2.0` assembly.

## What's new in 3.x

3.x is **additive over 2.x with no breaking API changes**. New opt-in members:

| Member | Use |
| ------ | --- |
| `Argument<T>.CaptureRemainingTokens` | greedy arg that captures all remaining tokens |
| `Option<T>` / `Argument<T>` `.AcceptOnlyFromAmong(StringComparer, params string[])` | case-insensitive constrained values (the `params string[]` overload already existed in 2.x) |
| `RootCommand.HelpName` | custom name for the root command in help output |

## 2.x to 3.x migration

**Drop-in.** Bump the version; no code changes are needed. Then optionally adopt the new
members above. The only consumer-visible shift is the dropped in-box `net8.0` target.

## 2.x-beta to 2.x migration

Unlike 2 to 3, **beta4 to 2.0 GA was a large breaking redesign**: the old invocation and
binding stack was removed. Core mappings:

| 2.0.0-beta4 | 2.x / 3.x GA |
| ----------- | ------------ |
| `AddOption` / `AddArgument` / `AddCommand` | `Options.Add` / `Arguments.Add` / `Subcommands.Add` |
| `AddGlobalOption(o)` | `o.Recursive = true;` then `Options.Add(o)` |
| `SetHandler(...)` | `SetAction(parseResult => ...)` |
| `command.Invoke` / `InvokeAsync` | `command.Parse(args).Invoke()` / `.InvokeAsync()` |
| `IsRequired` | `Required` |
| `ExistingOnly()` | `AcceptExistingOnly()` |
| `SetDefaultValue` / `SetDefaultValueFactory` | `DefaultValueFactory` |
| `ArgumentHelpName` | `HelpName` |
| `new Option<T>("--n", "desc")` (2nd arg = description) | `new Option<T>("--n") { Description = "desc" }` (2nd ctor arg is now an **alias**) |
| binding: `BinderBase<T>` / `BindingContext` / `IValueDescriptor` | `parseResult.GetValue(option)` |
| `IConsole` / `HelpBuilder` | removed; use `Console`, customize help via `HelpAction` |

## Gotchas
- Options and args are referenced by **identity**: keep the instance to pass to `GetValue`.
- The 2nd positional ctor arg is an **alias**, not a description (a silent shift since beta4).
- Bumping 2.x to 3.x needs no code edits; do not "modernize" working 2.x patterns.
