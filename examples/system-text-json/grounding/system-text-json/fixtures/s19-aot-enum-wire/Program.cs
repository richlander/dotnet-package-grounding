// TODO: see the task description.

var job = new Job("nightly", JobStatus.Complete);

enum JobStatus { Queued, Running, Complete }
record Job(string Name, JobStatus Status);
