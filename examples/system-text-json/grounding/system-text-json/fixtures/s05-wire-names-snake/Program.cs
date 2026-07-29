// TODO: see the task description.

var package = new PackageInfo("Serilog", 1234);

const string Incoming = """{"package_id":"Serilog","download_count":1234}""";

record PackageInfo(string PackageId, int DownloadCount);
