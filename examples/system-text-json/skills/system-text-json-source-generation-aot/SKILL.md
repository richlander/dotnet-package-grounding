---
name: system-text-json-source-generation-aot
version: 10.0.0
description: >-
  Use when System.Text.Json runs under Native AOT or trimming (PublishAot / PublishTrimmed), or when
  you want the faster, reflection-free serialization path — i.e. a JsonSerializerContext with
  [JsonSerializable]. Reflection-based JsonSerializer compiles but THROWS at run time under AOT; the
  source generator is the only supported path. Also covers configuring a context with
  [JsonSourceGenerationOptions] and why naming policy is per-context, not per-model, so one type
  serialized by two contexts can emit two different spellings.
---

# Source generation & Native AOT

## Required setup

`JsonSerializerContext` and `[JsonSerializable]` are in `System.Text.Json.Serialization`, not
`System.Text.Json`. The context class **must be `partial`** — the generator extends it, so a
non-partial context does not compile:

```csharp
using System.Text.Json;                 // JsonSerializer, JsonSerializerOptions
using System.Text.Json.Serialization;   // JsonSerializerContext, [JsonSerializable], [JsonSourceGenerationOptions]
```

Reflection-based `JsonSerializer.Serialize<T>(value)` / `Deserialize<T>(string)` is **disabled under
Native AOT (`PublishAot=true`) and trimming**. It still **compiles** (only an `IL3050`/`IL2026`
warning) but **throws `InvalidOperationException` at run time**: *"Reflection-based serialization has
been disabled…"*. Do **not** "fix" it by removing `PublishAot` or setting
`JsonSerializerIsReflectionEnabledByDefault=true` — that reintroduces the AOT break. Use the source
generator.

## The pattern

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;

[JsonSerializable(typeof(List<Advisory>))]   // one entry per ROOT type you (de)serialize
[JsonSerializable(typeof(Advisory))]
internal partial class AppJsonContext : JsonSerializerContext { }   // MUST be partial

// Deserialize / serialize through the generated, strongly-typed property:
var items = JsonSerializer.Deserialize(json, AppJsonContext.Default.ListAdvisory);
string s  = JsonSerializer.Serialize(items, AppJsonContext.Default.ListAdvisory);
```

- The generated property is named after the type: `List<Advisory>` → `ListAdvisory`, `Advisory` →
  `Advisory`. Pass `Context.Default.<TypeName>` to the `JsonTypeInfo<T>` overload.
- Alternatively wire it into an options object:
  `var options = new JsonSerializerOptions { TypeInfoResolver = AppJsonContext.Default };` then call
  the normal `Serialize/Deserialize<T>(value, options)` overloads.
- Register **every root type** you pass to `Serialize`/`Deserialize`. Nested/property types are
  discovered automatically; a missing ROOT type is a build-time source-gen error or a run-time throw.

## Configure the context with `[JsonSourceGenerationOptions]`

Options that would go on a `JsonSerializerOptions` instance move onto the context via attribute —
this is how a real AOT tool sets naming/nulls/enum handling (matches how CLIs shape their JSON output):

```csharp
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower,   // or CamelCase
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = true,
    UseStringEnumConverter = true)]                                // .NET 9+: enums as strings, AOT-safe
[JsonSerializable(typeof(Report))]
internal partial class ReportContext : JsonSerializerContext { }
```

- **Separate contexts for separate output shapes.** A tool that emits both indented "pretty" JSON and
  compact JSONL typically declares two contexts (one `WriteIndented = true`, one not; compact modes
  often use `WhenWritingDefault`). Options are baked into the context at generation time, so you pick
  the shape by choosing the context.
- **`UseStringEnumConverter = true`** is the AOT-safe way to get string enums — the reflection-based
  `new JsonStringEnumConverter()` added to an options list is NOT AOT-safe for source-gen contexts.

## Naming is declared per *context*, not per model

`PropertyNamingPolicy` lives on the context (via `[JsonSourceGenerationOptions]`), **not** on the
model type. Two consequences bite real tools:

- **One model serialized by two contexts can get two spellings.** The indented/compact pair above,
  or a row type shared between a document context and a JSONL context, are the usual cases. Nothing
  ties the declarations together.
- **A context declared without a naming policy silently emits CLR PascalCase**, while every sibling
  context emits snake_case or camelCase. It compiles, it round-trips against itself, and it is only
  visible to someone diffing actual output — a shipped wire format that is expensive to correct later.

Neither is caught by the compiler, so assert it in a test. Discover contexts by **reflection** rather
than listing them, so a newly declared context is covered the moment it exists, and walk each
context's type graph **transitively** — naming attributes are not transitive, so nested types are
exactly where a spelling change hides:

```csharp
using System.Reflection;   // the gate walks the assembly's types

// For every JsonSerializerContext in the assembly, for every type reachable from it,
// assert each serialized property name equals policy.ConvertName(clrPropertyName).
foreach (Type ctx in assembly.GetTypes()
             .Where(t => typeof(JsonSerializerContext).IsAssignableFrom(t) && !t.IsAbstract))
{
    // ... resolve the context's declared policy, walk JsonTypeInfo.Properties transitively,
    //     and compare property.Name against the policy applied to the CLR member name.
}
```

Verify the gate is not vacuous: it should fail if you remove a `PropertyNamingPolicy` from one
context, and fail if discovery stops finding contexts.

## Gotchas

- The context class **must be `partial`** and typically `internal`/`private`. A non-partial context
  won't compile (the generator can't extend it).
- Under AOT, do **not** add converters that rely on reflection; prefer attribute-driven configuration.
- `JsonSerializerContext` metadata is generated at build time — after changing types, rebuild.
