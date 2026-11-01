# Audit example plugin

`plugin.ts` observes the existing scheduler service's `run` method. It logs call ID, task ID,
optional schedule ID and elapsed milliseconds; never task inputs, results or raw errors.
Service interceptors already observe across plugins and have no Action-style scope option.
Logging is observational, not awaited or durable. A production consumer may replace console
calls with its own authorized DB/file service and must handle that service's failures.
Verify that the scheduler tests report one trace per automatic or manual invocation.
