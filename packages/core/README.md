# BitaKit Core

**Give your application a shared home for plugins, services, and actions.**

`@bitakit/core` coordinates how features start, work together, and stop. It runs
without React, a browser, or a particular router. Your application still owns its
pages, interface, business rules, and data storage.

BitaKit is a composition layer alongside frameworks such as Next.js and TanStack
Start, not a replacement for them. Its explicit plugin, service, and action
conventions give people and AI coding assistants a shared structure to work with.

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

## Install

```sh
npm install @bitakit/core
```

The example below uses Node.js and no UI. For a React application, bindings live
in `@bitakit/ui`; framework-specific integration lives in `@bitakit/next` or
`@bitakit/tanstack`. Those packages are separate from Core and are being prepared
for publication. TanStack support is experimental.

## Try a To-do plugin

Follow the [To-do tutorial](docs/todo-tutorial.md) to run three actions: create a
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
See [file contributions](docs/file-contributions.md) for the exact conventions.

## React to events

The following API is available in the workspace and is not yet part of the
published Core 0.1.0 release. Each runtime owns one event service. Services emit
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
        items = items.filter(todo => todo.id !== id);
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
  requires: ['todos'],
  events: ['todos.changed'],
  setup({ services, action }) {
    action.enabled = services.todos.list().length > 0;
  },
  onEvent(event, { services, action }) {
    action.enabled = services.todos.list().length > 0;
  },
  execute: ({ services, input }) => services.todos.remove(input),
});
```

Here discovery supplies `todos` and `todos.delete` from the paths (with no explicit
app namespace). Plugin contributions also receive their plugin namespace. Provide
an explicit `id` when you need a custom identity. Direct imports without discovery,
including the Node tutorial above, still need explicit IDs.

`events: ['todos.loaded', 'todos.changed']` calls `onEvent` for
**each** matching event. Handlers receive `{ type, data }` and can be synchronous or
asynchronous. Core owns subscriptions created in action `setup` and service
`create`, including cleanup after failed setup. No manual unsubscribe is needed.
For dynamic subscriptions, `setup` still offers `events.watch`. React components use `useWatchEvent` from `@bitakit/ui`.

See [events and action setup](docs/events.md) for payload typing, errors, async
cancellation, and the distinction from observable-service `watch`.

## What belongs outside Core?

- **React rendering:** the UI bindings and your visual components.
- **Routes and navigation:** your application's router and its BitaKit adapter.
- **Settings:** the separate App Preferences package.
- **Email, authentication, and persistence:** optional integrations or your own services.

Plugins are trusted application code. Core is not a sandbox or a remote plugin marketplace.

## Go deeper

- [Runnable To-do example](examples/todos.mjs)
- [Core reference](docs/reference.md): configuration, typed services, actions, lifecycle, and advanced integration.
- [File contributions and configuration](docs/file-contributions.md): discovery and folder conventions.
- [Source repository](https://github.com/mvavesal/bitakit)

## License

[MIT](LICENSE). Third-party dependencies retain their own licenses.

See [client authentication](docs/auth.md) for the shared provider contract, externally
configured login/logout paths, UI bindings and an adapter template (workspace APIs).
