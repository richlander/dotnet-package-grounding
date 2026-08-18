---
name: system-text-json-dotnet-10-11-strictness
version: 10.0.0
description: >-
  Use when targeting recent .NET runtimes (8/9/10+) and you need the newer, stricter System.Text.Json
  behavior or APIs a model trained on older docs may not know — the JsonSerializerOptions.Strict
  preset, AllowDuplicateProperties, RespectNullableAnnotations / RespectRequiredConstructorParameters,
  rejecting unknown/unmapped configuration properties, PipeReader overloads, and JsonMarshal. Also
  covers why duplicate-key rejection matters at untrusted parse boundaries, the .NET 11
  [JsonNamingPolicy] attribute and its non-transitivity, and getting newer STJ APIs on an older
  runtime via the out-of-band package.
---

# Newer-runtime strictness & APIs (.NET 8 → 10)

## Required setup

```csharp
using System.Text.Json;                 // JsonSerializerOptions, JsonSerializer, JsonMarshal
using System.Text.Json.Serialization;   // JsonUnmappedMemberHandling, [JsonUnmappedMemberHandling]
```

These are options-level settings, so they apply only where you pass the options instance. Build it
once and reuse it — options become effectively read-only after the first (de)serialization, so the
strictness knobs must be set before then. `options` in the examples below is that instance.

The frontier often defaults to older STJ behavior. These are the recent, verified changes worth
reaching for on modern targets.

## `.NET 10`: the `Strict` preset (opt into best-practice defaults)

```csharp
var options = JsonSerializerOptions.Strict;   // a shared, read-only preset
```

`Strict` bundles the security/correctness-hardening options:

- `JsonUnmappedMemberHandling.Disallow` — JSON with an unknown property **throws** instead of silently
  dropping it.
- `AllowDuplicateProperties = false` — a payload with a repeated property name **throws** (mitigates
  the JSON-interoperability class of vulnerabilities; the default was last-one-wins).
- **Case-sensitive** property binding (preserved).
- `RespectNullableAnnotations = true` and `RespectRequiredConstructorParameters = true` — non-nullable
  members and required ctor parameters are enforced on deserialize.

`Strict` is **read-compatible with `Default`**: anything serialized with `Default` deserializes under
`Strict`. Prefer it for untrusted input rather than hand-assembling the same four options.

### Why duplicate rejection matters (it is not theoretical)

JSON does not define how a repeated object key resolves, so **two readers of the same payload can
disagree** — and last-one-wins vs first-one-wins is exactly the split that turns a parse quirk into a
spoofing bug. A real instance: one component resolved a source-file URL by longest-pattern match
while another reported the repository URL by first-known-host match; given a repeated key, they
selected **different entries** from one document, so the tool resolved content from one origin while
reporting provenance from another.

Set `AllowDuplicateProperties = false` (or use `Strict`) at **every parse boundary that accepts
untrusted input**, and note the knob exists on the DOM entry points too, not just the serializer:

```csharp
var docOptions = new JsonDocumentOptions { AllowDuplicateProperties = false };
using var doc = JsonDocument.Parse(untrustedJson, docOptions);
```

Callers that already treat malformed JSON as "no data" will treat duplicate-bearing JSON the same
way — fail-closed, and consistent with their existing handling.

## Individual knobs (available without the whole preset)

- `new JsonSerializerOptions { AllowDuplicateProperties = false }` — also on `JsonDocumentOptions`.
- `RespectNullableAnnotations = true` (.NET 9+) — a `null` for a non-nullable reference member throws.
- `RespectRequiredConstructorParameters = true` (.NET 9+) — a missing required ctor parameter throws.
- `JsonUnmappedMemberHandling.Disallow` via `[JsonUnmappedMemberHandling(...)]` on a type or on options.

## `.NET 10`: `PipeReader` support

`JsonSerializer` gained `System.IO.Pipelines.PipeReader` overloads — deserialize directly off a pipe
without an intermediate `Stream` copy (ASP.NET Core request bodies now use this internally):

```csharp
var value = await JsonSerializer.DeserializeAsync<MyType>(pipeReader, options);
await foreach (var item in JsonSerializer.DeserializeAsyncEnumerable<Item>(pipeReader, options)) { }
```

## `JsonMarshal` (advanced / high-performance)

`System.Text.Json.JsonMarshal` exposes the raw backing UTF-8 bytes of a `JsonElement`
(`GetRawUtf8Value`) for zero-copy scenarios. Reach for it only in measured hot paths.

## `.NET 11`: `[JsonNamingPolicy]` is **not transitive**

.NET 11 adds a `JsonNamingPolicyAttribute` so a naming policy can sit on the model instead of being
repeated on every context. It does **not** do what the name suggests: it overrides the context policy
for **that type's own properties only**, and nested types keep the context policy. Verified:

```text
ctx = SnakeCase, [JsonNamingPolicy(CamelCase)] on Outer:
{"outerProp":"a","nested":{"nested_prop":"b"}}
                          ^ nested type ignored the attribute
```

So it does not make naming intrinsic to a model graph. Making it so would mean attributing **every
type in the transitive graph**, which is more duplication than the per-context lines it removes — and
any type you miss silently changes that shape's wire names. Prefer a test that asserts every wire
name matches its context's declared policy over adopting the attribute for this purpose.

## Getting .NET 11 STJ APIs without targeting .NET 11

`System.Text.Json` also ships **out-of-band**, and the package's LTS-floor TFM does not stop a newer
package from loading on an older runtime. Verified: a `net10.0` app referencing
`System.Text.Json 11.0.0-preview.*` loads the app-local `System.Text.Json.dll` v11.0.0.0 on the
.NET 10.0.8 runtime, with the net11-only APIs working and the source generator honoring them.

So "that API is .NET 11" is not by itself a reason to rule it out on a .NET 10 target — add the
package reference. Weigh it as a dependency decision, not an impossibility.

## AOT-safe string enums (.NET 9+)

On a source-gen context prefer `[JsonSourceGenerationOptions(UseStringEnumConverter = true)]` over
adding `new JsonStringEnumConverter()` to an options list — the latter is
not trim/AOT-safe. The generic `JsonStringEnumConverter<TEnum>` (.NET 8+) is the AOT-friendly
per-enum form.

> Reserved-metadata note: a member whose serialized name collides with a metadata property
> (`$type` / `$id` / `$ref`) is rejected on modern runtimes — rename the member or set a
> `[JsonPropertyName]` that doesn't collide.
