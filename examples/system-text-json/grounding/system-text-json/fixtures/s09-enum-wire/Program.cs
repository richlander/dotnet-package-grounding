// TODO: see the task description.

var job = new Job("nightly", JobStatus.Complete);

const string Incoming = """{"Name":"nightly","Status":"Complete"}""";

enum JobStatus { Queued, Running, Complete }
record Job(string Name, JobStatus Status);
