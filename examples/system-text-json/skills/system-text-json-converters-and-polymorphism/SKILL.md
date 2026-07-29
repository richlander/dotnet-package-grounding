---
name: system-text-json-converters-and-polymorphism
version: 10.0.0
description: >-
  Use when System.Text.Json needs custom value handling — a JsonConverter<T> for a type STJ can't
  round-trip out of the box (custom dates, value objects, unions), string enums, or polymorphic
  (base/derived) serialization with a type discriminator.
---

# Custom converters & polymorphism

## Required setup

Converter and polymorphism attributes live in `System.Text.Json.Serialization`, not
`System.Text.Json` — the most common reason this code does not compile:

```csharp
using System.Text.Json;                 // JsonSerializer, JsonSerializerOptions, Utf8JsonReader/Writer
using System.Text.Json.Serialization;   // JsonConverter<T>, [JsonConverter], [JsonPolymorphic], [JsonDerivedType]
```

Build one options instance and reuse it — a fresh one is expensive (it caches per-type metadata on
first use), and options become effectively read-only after first use, so add converters before then:

```csharp
static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
{
    Converters = { new DateOnlyConverter() },
};
```

`options` in the examples below is that instance.

## String enums

Enums serialize as **numbers** by default. For strings:

```csharp
// Per-type (AOT-safe under source generation, which is covered separately):
[JsonConverter(typeof(JsonStringEnumConverter<MatchKind>))]   // generic form, .NET 8+
public enum MatchKind { Exact, Prefix, Fuzzy }

// Or globally on the options (reflection-based; fine for non-AOT):
options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
```

## A custom `JsonConverter<T>`

Reach for this when a type needs a representation STJ won't produce — a non-ISO date format, a
value object serialized as a scalar, a discriminated union, etc.

```csharp
public sealed class DateOnlyConverter : JsonConverter<DateOnly>
{
    private const string Fmt = "yyyy-MM-dd";
    public override DateOnly Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o) =>
        DateOnly.ParseExact(reader.GetString()!, Fmt);
    public override void Write(Utf8JsonWriter writer, DateOnly value, JsonSerializerOptions o) =>
        writer.WriteStringValue(value.ToString(Fmt));
}
// Attach: options.Converters.Add(new DateOnlyConverter());  OR  [JsonConverter(typeof(DateOnlyConverter))]
```

- `Read` is called positioned on the FIRST token of the value; consume exactly one value. For object
  converters, advance with `reader.Read()` and stop at the matching `EndObject`.
- `Write` must emit exactly one JSON value.
- A converter attached with `[JsonConverter]` on a member/type wins over one in `options.Converters`.

## Polymorphism (base → derived with a discriminator)

Built-in since .NET 7 — prefer it over a hand-rolled converter:

```csharp
[JsonPolymorphic(TypeDiscriminatorPropertyName = "$type")]
[JsonDerivedType(typeof(Dog), typeDiscriminator: "dog")]
[JsonDerivedType(typeof(Cat), typeDiscriminator: "cat")]
public abstract class Animal { public string Name { get; set; } = ""; }
public sealed class Dog : Animal { public bool GoodBoy { get; set; } }
public sealed class Cat : Animal { public int Lives { get; set; } }
```

- Serializing an `Animal` reference emits `"$type":"dog"` + the derived properties; deserializing an
  `Animal` reads the discriminator to pick the type.
- The discriminator must appear **first** in the JSON object when reading (STJ requires it up front
  unless buffered). Only declared `[JsonDerivedType]`s are allowed — unknown discriminators throw.

## Extension data (round-trip unknown properties)

```csharp
[JsonExtensionData] public Dictionary<string, JsonElement> Extra { get; set; } = new();
```

Captures JSON members with no matching CLR property and writes them back out — the STJ equivalent of
Newtonsoft's `[JsonExtensionData]`. Use `JsonElement` (or `object`) as the value type.
