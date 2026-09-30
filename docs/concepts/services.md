# Services: reusable behavior with an owner

A service exposes behavior that several parts of your application need. A task
service might provide `add()` and `list()`. An email service might provide `send()`.
The consumer uses the contract without needing to know every implementation detail.

## What Core coordinates

A plugin declares its services and dependencies. Core creates plugin-owned services
when the runtime mounts, makes them available to consumers, and runs their declared
cleanup when the runtime stops. Factories should not acquire resources merely because
a plugin definition was imported.

A service may keep local state, call a remote API, or wrap an external library. Core
does not automatically persist that state or make every method reactive. Data-change
subscriptions must be part of the service's intended contract.

## Separate the contract from the provider

The email package defines a shared contract; the Nodemailer package supplies an
implementation. Both remain optional. Provider-specific code belongs in its adapter,
not in Core. Replacing an implementation still requires satisfying the same contract
and configuring any credentials or server resources it needs.

The [To-do tutorial](../../packages/core/docs/todo-tutorial.md) starts with an in-memory
service. See the [Core reference](../../packages/core/docs/reference.md) for typed
service keys, dependency declarations, and host-owned service lifetimes.
