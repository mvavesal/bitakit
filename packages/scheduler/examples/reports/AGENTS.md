# Reports example plugin

Declares `reports.weekly` as both a task and a default schedule in separate namespaces.
The task accepts `{ audience: string }` and returns an example result; it sends no real mail.
The default runs Mondays at 09:00 Europe/Berlin. Keep executable code in `contributions/tasks`
and schedule data in `contributions/schedules`. Domain authorization belongs in real business
services. See the scheduler package guide for runtime ownership and source overrides.
Verify with the package tests and `examples/server/main.ts --once`.
