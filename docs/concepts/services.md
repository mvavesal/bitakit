# Services: behavior and state with an owner

A service exposes behavior that several parts of your application need. A task
service might provide `add()` and `list()` and keep the tasks in a `store()`. An email
service might provide `send()`. The consumer uses the contract without needing to know
every implementation detail.

## What Core coordinates

A plugin's services live in `services/<file>.ts` and are reached as
`services.<plugin>.<file>`. Core creates them when the runtime mounts, in dependency
order, makes them available to every contribution, awaits their `onStart` hooks before
the app is ready, and runs their `onStop` hooks when the runtime stops. Factories should
not acquire resources merely because a plugin definition was imported.

A service may keep local state, call a remote API, or wrap an external library. State
kept in `store()` is observable: actions re-evaluate their function-valued fields and
pages re-render through `useServiceState` without extra wiring. Core does not persist
that state; storage is the service's job.

## Separate the contract from the provider

The email package defines a shared contract; the Nodemailer package supplies an
implementation. Both remain optional. A contract is a typed service key created with
`defineContract<T>('email')`; the provider's service declares `provides: contract`, and
consumers read it under that name. Provider-specific code belongs in its adapter, not in
Core. Replacing an implementation still requires satisfying the same contract and
configuring any credentials or server resources it needs.

The [To-do tutorial](../../packages/core/docs/todo-tutorial.md) starts with an in-memory
service. See the [Core reference](../../packages/core/docs/reference.md) for the service
context, contracts, dependency declarations, and host-owned service lifetimes.
