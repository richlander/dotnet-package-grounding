// TODO: see the task description.

var row = new PackageRow("System.Text.Json", 12345, null);

record PackageRow(string PackageId, int DownloadCount, string? Notes);
