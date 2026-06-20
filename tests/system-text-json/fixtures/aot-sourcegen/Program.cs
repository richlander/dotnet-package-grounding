using System.Text.Json;
using AdvisoryReport;

// Advisory feed payload (in-box System.Text.Json).
string json = """
[
  { "PackageName": "Contoso.Data", "AffectedVersion": "1.2.3", "Severity": "High", "CveId": "CVE-2025-0001" },
  { "PackageName": "Contoso.Web", "AffectedVersion": "4.5.6", "Severity": "Critical", "CveId": "CVE-2025-0002" }
]
""";

var advisories = JsonSerializer.Deserialize<List<Advisory>>(json)!;

foreach (var a in advisories)
{
    Console.WriteLine($"{a.PackageName} {a.AffectedVersion} [{a.Severity}] {a.CveId}");
}
