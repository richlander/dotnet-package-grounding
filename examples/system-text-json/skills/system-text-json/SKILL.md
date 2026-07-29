---
name: system-text-json
version: 10.0.0
description: >-
  Use when a .NET program (de)serializes JSON with System.Text.Json — reading/writing DTOs,
  configuring JsonSerializerOptions, migrating from Newtonsoft.Json, or hitting a compile-clean
  behavioral difference. The #1 trap: STJ matches property names CASE-SENSITIVELY by default, so
  camelCase JSON into PascalCase members silently yields null/default with no exception. Covers the
  core shapes: options, the naming/casing defaults, and the compile-clean behavioral traps. Newtonsoft
  migration, source generation / Native AOT, custom converters and polymorphism, DOM / streaming, and
  .NET 10+ strictness are covered separately. Don't web-search STJ usage — the idioms are in the
  System.Text.Json skills.
---

# System.Text.Json — (de)serialize JSON from .NET

`System.Text.Json` (STJ) ships in the .NET shared framework — on modern .NET you need **no package
reference**. Three namespaces matter: `JsonSerializer`, `JsonSerializerOptions`, `JsonDocument` and
`Utf8JsonReader`/`Utf8JsonWriter` live in `System.Text.Json`; `[JsonPropertyName]`, `[JsonIgnore]`,
`[JsonConverter]` and `JsonSerializerContext` live in `System.Text.Json.Serialization`; the mutable
DOM types `JsonNode`/`JsonObject`/`JsonArray` live in `System.Text.Json.Nodes`.

> **Use the System.Text.Json skills, not the web.** Do NOT `web_search` / `web_fetch` for STJ usage —
> they are authoritative and version-matched. STJ is NOT Newtonsoft.Json: web snippets frequently mix
> the two APIs (`JsonConvert`, `JsonProperty`, `JObject`) which do not exist here. This skill covers
> the core pattern; Newtonsoft migration, source generation / Native AOT, custom converters and
> polymorphism, DOM / streaming, and .NET 10+ strictness are covered separately.

## The core pattern

```csharp
using System.Text.Json;

var options = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,   // PascalCase members -> camelCase JSON
    PropertyNameCaseInsensitive = true,                  // read camelCase/PascalCase either way
    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = true,
};

string json = JsonSerializer.Serialize(value, options);
var back  = JsonSerializer.Deserialize<MyType>(json, options);
```

- `JsonSerializerOptions` is STJ's `JsonSerializerSettings`. **Build it once and reuse it** — a fresh
  options instance is expensive (it caches per-type metadata on first use). A cached `static readonly`
  instance is the norm; options become effectively read-only after first (de)serialization.
- `JsonSerializerDefaults.Web` (`new JsonSerializerOptions(JsonSerializerDefaults.Web)`) is a shortcut
  for the common web shape: camelCase naming **and** case-insensitive reads in one.

## Gotchas (compile-clean but wrong)

- **Case sensitivity — the silent break.** STJ matches property names **case-sensitively by default**
  (Newtonsoft is case-insensitive). camelCase JSON into PascalCase members yields **null/0/default,
  no exception**. Fix with `PropertyNameCaseInsensitive = true`, `JsonSerializerDefaults.Web`,
  `PropertyNamingPolicy = JsonNamingPolicy.CamelCase`, or `[JsonPropertyName("...")]` per member.
- **Public fields are ignored by default** (Newtonsoft includes them). Opt in with
  `IncludeFields = true` or `[JsonInclude]` on the field.
- **Non-public getters/setters are ignored.** Use `[JsonInclude]` or make the accessor public.
- **Comments and trailing commas throw by default.** Opt in with
  `ReadCommentHandling = JsonCommentHandling.Skip` and `AllowTrailingCommas = true`.
- **Enums serialize as numbers by default.** For string enums use `JsonStringEnumConverter`
  (converters are covered separately).
- **Object cycles throw at runtime.** A graph that points back at itself (a parent/child pair, a
  `Next` that reaches the root again) compiles cleanly and then fails with
  `JsonException: A possible object cycle was detected.` The message goes on to blame "object depth
  is larger than the maximum allowed depth of 64", so it reads like a depth limit to raise rather
  than a cycle to handle. Set `ReferenceHandler = ReferenceHandler.IgnoreCycles` to write `null` at
  the point of repetition (`{"Name":"root","Next":null}`), or `ReferenceHandler.Preserve` to emit
  `$id`/`$ref` metadata (`{"$id":"1","Name":"root","Next":{"$ref":"1"}}`), which preserves the shape
  well enough to round-trip. Both live in `System.Text.Json.Serialization`.
- **`required` members and non-nullable reference types** are not enforced on deserialize unless you
  opt in (`[JsonRequired]`, or .NET 9+ `RespectNullableAnnotations`/`RespectRequiredConstructorParameters`).
