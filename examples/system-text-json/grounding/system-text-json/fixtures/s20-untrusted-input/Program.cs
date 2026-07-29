// TODO: see the task description. The payload below arrives from an untrusted source.

const string Untrusted = """{"role":"guest","role":"admin"}""";

class Principal
{
    public string Role { get; set; } = "";
}
