using Newtonsoft.Json;

var sample = JsonConvert.DeserializeObject<TelemetrySample>("""{"name":"demo","count":3}""")!;
Console.WriteLine($"name={sample.Name} count={sample.Count}");

class TelemetrySample
{
    public string Name = "";
    public int Count;
}
