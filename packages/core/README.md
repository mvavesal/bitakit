<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/assets/bitakit-banner.png" alt="BitaKit — Your app. Your building blocks. An AI-friendly composition layer for modern applications." width="1024">
</p>

# BitaKit Core

**Build bigger apps from smaller, pluggable features — together with your team and AI.**

BitaKit gives **developers and AI coding assistants a shared structure** for building
applications. Organize a feature into a plugin, put reusable behavior in services,
and expose operations through actions. Each piece has a clear home, a clear role,
and typed connections to the rest of your app.

**Keep Next.js, TanStack Start, or your own stack.** BitaKit adds feature organization
and shared lifecycle management alongside your framework. You keep control of your
routes, UI, business rules, and data.

## Contents

- [Install](#install)
- [Why add BitaKit?](#why-add-bitakit)
- [How the pieces fit](#how-the-pieces-fit)
- [Try a To-do plugin](#try-a-to-do-plugin)
- [Type safety that follows your feature](#type-safety-that-follows-your-feature)
- [React to events](#react-to-events)
- [What belongs outside Core?](#what-belongs-outside-core)
- [Go deeper](#go-deeper)
- [License](#license)

## Install

```sh
npm install @bitakit/core
```

Core works in **Node.js and the browser**, without React or a router.

Starting a new application? Let the generator connect the packages for you:

```sh
npx @bitakit/create-app my-app
```

The generator requires Node.js 24 or newer. Choose Next.js or experimental TanStack
Start, then select the optional features you want. React bindings and framework
adapters are available as separate packages.

## Why add BitaKit?

Your framework handles pages and rendering. As an app grows, you also need a clear
way to organize features, share behavior, connect dependencies, and clean up resources.
BitaKit gives those pieces a common structure.

- **Smaller pieces. Clearer ownership.** Keep a feature's services and actions together
  in a plugin. Teams can work on focused parts of the app with explicit connections
  between them.
- **A shared language for humans and AI.** Predictable files and typed contracts make
  it easier to describe a change, give an AI assistant focused context, and review
  its work. The same conventions guide both developers and coding assistants.
- **Pluggable features.** Compose the capabilities your app needs. Add a plugin,
  configure its defaults, or replace supported contributions through the same APIs.
- **Less repeated wiring.** With discovery configured, file paths supply names and
  generated types. Core handles startup, dependencies, registration, and cleanup.
- **Type-safe connections.** Service methods, action inputs and results, and known
  event payloads carry their types to callers. Your editor helps you connect the pieces.
- **Your stack stays yours.** Start with headless Core. Add React bindings, settings,
  an app shell, or provider integrations when they help your product.

**Room to grow.** As your app and team grow, keep changes focused on small features
with explicit dependencies. This is about scaling your codebase and collaboration;
performance and infrastructure remain choices for your application.

## How the pieces fit

Imagine a **To-do plugin** that lets someone add a task:

```text
Application — chooses which plugins to use
    │
    ▼
BitaKit Core — starts plugins and checks their dependencies
    │
    └── To-do plugin — groups one feature's contributions
          ├── Service: holds tasks and provides add/list operations
          └── Action: calls the service to add a task

Button or server code
    │ executes "todos.create"
    ▼
Action ──calls──▶ To-do service ──returns──▶ Task

Application UI displays the result; Core does not render it.
```

| Concept          | What it does                                                        | In this example                                   |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| **Plugin**       | Bundles the parts of a feature.                                     | The To-do feature.                                |
| **Service**      | Owns reusable behavior and, when needed, state or resources.        | Stores tasks and exposes `create()` and `list()`. |
| **Action**       | Provides a named operation that application code or UI can execute. | `todos.create` adds a task through the service.   |
| **Core runtime** | Coordinates dependencies, registrations, startup, and cleanup.      | Creates the service and registers the action.     |

Core manages the lifecycle of plugin-created services. A service that acquires
resources can supply disposal logic. Core does not automatically save data to a
database or subscribe your UI to service changes.

## Try a To-do plugin

Follow the [To-do tutorial](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/docs/todo-tutorial.md) to run three actions: create a
task, list tasks, and delete a task. Each action lives in its own file:

```text
examples/
├── todos.mjs                  # Starts the runtime and executes the actions
└── todos/
    ├── plugin.mjs             # Groups the service and actions
    ├── services/
    │   └── tasks.mjs          # In-memory task operations
    └── actions/
        ├── create.mjs         # todos.create
        ├── list.mjs           # todos.list
        └── delete.mjs         # todos.delete
```

The plugin uses explicit imports, so no framework or discovery setup is required.
The script creates three tasks, lists them, deletes the second, and lists the two
remaining tasks. Stopping the runtime releases its registrations. Data stays in
memory and is lost on restart.

With a configured framework adapter, contribution files can instead live under
`src/plugins/todos/services` and `src/plugins/todos/actions`. Its build integration
generates registration and types. Installing Core alone does not scan folders.
See [file contributions](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/docs/file-contributions.md) for the exact conventions.

## Type safety that follows your feature

Define a service once, then use its method types wherever you call it. Discovery
connects supported files to typed service access, action IDs, and configuration.
Shared service keys let separate packages agree on the same contract.

Use `exposeAs` when you want a custom public service name; otherwise discovery uses
the file path. Known event names and payloads are connected through `EventMap`.

Unknown action IDs remain allowed unless strict mode is enabled. TypeScript checks
code; validate external data and authorize requests at your application boundaries.
See the [Core reference](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/docs/reference.md)
for examples.

## React to events

Available since Core 0.1.1, each runtime owns one event service. Services emit
notifications after updating their data; actions declare `events` and `onEvent`.

With file discovery configured, IDs can be omitted:

```ts
// src/services/todos.ts
import { defineService } from '@bitakit/core';

export default defineService({
  create({ events }) {
    let items: { id: number; title: string }[] = [];
    let nextId = 1;
    return {
      list: () => [...items],
      add(title: string) {
        const todo = { id: nextId++, title };
        items.push(todo);
        events.emit('todos.changed', { kind: 'added', id: todo.id });
      },
      remove(id: number) {
        items = items.filter((todo) => todo.id !== id);
        events.emit('todos.changed', { kind: 'removed', id });
      },
    };
  },
});
```

```ts
// src/actions/todos/delete.ts
import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  // Initial state: the list starts empty, so deleting is disabled.
  enabled: false,

  // Events this action reacts to.
  events: ['todos.changed'],

  // Runs each time one of those events is emitted. Core owns the subscription.
  onEvent(_event, { services, action }) {
    action.enabled = services.todos.list().length > 0;
  },

  // Runs when a bound control or your code executes the action.
  execute: ({ services, input }) => services.todos.remove(input),
});
```

Here discovery supplies `todos` and `todos.delete` from the paths (with no explicit
app namespace). Plugin contributions also receive their plugin namespace. Provide
an explicit `id` when you need a custom identity. Direct imports without discovery,
including the Node tutorial above, still need explicit IDs.

Reacting to events needs no `setup` method. Declaring events does not send an
initial event, so state that is known up front, such as `enabled: false` for an
empty list, belongs in the definition. Add `setup` only when the initial state must
be read from existing data; it runs once when the action registers.

`events: ['todos.loaded', 'todos.changed']` calls `onEvent` for
**each** matching event. Handlers receive `{ type, data }` and can be synchronous or
asynchronous. Core owns the `onEvent` subscription and those created in action `setup`
and service `create`, including cleanup after failed setup. No manual unsubscribe is needed.
For dynamic subscriptions, `setup` still offers `events.watch`. React components use `useWatchEvent` from `@bitakit/ui`.

See [events and action setup](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/docs/events.md) for payload typing, errors, async
cancellation, and the distinction from observable-service `watch`.

## What belongs outside Core?

- **React rendering:** the UI bindings and your visual components.
- **Routes and navigation:** your application's router and its BitaKit adapter.
- **Settings:** the separate App Preferences package.
- **Email, authentication, and persistence:** optional integrations or your own services.

Plugins are trusted application code. Core is not a sandbox or a remote plugin marketplace.

## Go deeper

- [Runnable To-do example](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/examples/todos.mjs)
- [Core reference](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/docs/reference.md): configuration, typed services, actions, lifecycle, and advanced integration.
- [File contributions and configuration](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/docs/file-contributions.md): discovery and folder conventions.
- [Client authentication](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/docs/auth.md): the shared provider contract, externally configured login/logout paths, UI bindings and an adapter template.
- [npm package](https://www.npmjs.com/package/@bitakit/core)

## License

[MIT](https://cdn.jsdelivr.net/npm/@bitakit/core@0.1.2/LICENSE). Third-party dependencies retain their own licenses.
