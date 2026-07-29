using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

var settings = new JsonSerializerSettings
{
    ContractResolver = new Newtonsoft.Json.Serialization.CamelCasePropertyNamesContractResolver(),
    NullValueHandling = NullValueHandling.Ignore,
};
settings.Converters.Add(new StringEnumConverter());

var profile = new Profile { DisplayName = "Ada", Tier = Plan.Pro, Bio = null };
Console.WriteLine(JsonConvert.SerializeObject(profile, settings));

var back = JsonConvert.DeserializeObject<Profile>("""{"DisplayName":"Ada","Tier":"Pro"}""", settings)!;
Console.WriteLine($"name={back.DisplayName} tier={back.Tier}");

enum Plan { Free, Pro }

class Profile
{
    public string DisplayName { get; set; } = "";
    public Plan Tier { get; set; }
    public string? Bio { get; set; }
}
