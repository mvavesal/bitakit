# Build your first To-do plugin

Create two tasks, list them, and delete one. This example shows how separate
**actions** share one **service**, how the service announces changes through **events**,
and how a **plugin** groups them. No UI or database is needed.

## Run the complete example

Use Node.js 24 in a new folder:

```sh
npm init -y
npm install @bitakit/core
```

Copy [todos.mjs](../examples/todos.mjs) and the [todos folder](../examples/todos) from
the installed package, preserving their relative paths:

```sh
cp -R node_modules/@bitakit/core/examples/. .
```

The walkthrough uses explicit imports; these files do not require a discovery-enabled host.

```text
my-example/
├── package.json
├── todos.mjs
└── todos/
    ├── plugin.mjs
    ├── events.mjs
    ├── services/
    │   └── tasks.mjs
    └── actions/
        ├── create.mjs
        ├── list.mjs
        └── delete.mjs
```

Run `node todos.mjs`. The script prints that the delete action is disabled before any
task exists and enabled afterwards, then lists two tasks, deletes task 2 and lists the
remaining task. Each action execution returns an outcome; successful execution has
`status: 'completed'` and its result in `value`.

## The service owns the task behavior

[The task service](../examples/todos/services/tasks.mjs) keeps tasks in a `store()` and
exposes `create(title)`, `list()`, and `delete(id)`. Its factory runs when Core mounts
the runtime and receives one context object: `{ services, config, events, store, onStart,
onStop }`. IDs increase independently of list length, so deletion does not cause ID
reuse. This is temporary memory, not database persistence.

After each mutation the service emits `todos.changed`. [events.mjs](../examples/todos/events.mjs)
declares that event with `defineEvents({ changed: event() })`; the plugin ID becomes the
prefix, and only the todos plugin may emit it.

## Three actions, one service

| Action                                               | Input      | Service operation | Successful result          |
| ---------------------------------------------------- | ---------- | ----------------- | -------------------------- |
| [todos.create](../examples/todos/actions/create.mjs) | Task title | `create(title)`   | Created task               |
| [todos.list](../examples/todos/actions/list.mjs)     | None       | `list()`          | Current tasks              |
| [todos.delete](../examples/todos/actions/delete.mjs) | Task ID    | `delete(id)`      | Whether a task was removed |

The actions reach the service as `services.todos.tasks`. The execution context supplies
`services` and the caller's `input`. The plugin imports these definitions and contributes
them to the same runtime; they do not create separate service instances.

```text
create action ──┐
list action   ──┼──▶ task service ──▶ store: shared in-memory tasks
delete action ──┘
```

The delete action declares `enabled: ({ services }) => services.todos.tasks.state.get().items.length > 0`.
Core re-evaluates that function whenever the store changes, so the action is disabled
while the list is empty and enabled as soon as a task exists. No subscription, no
initial check and no cleanup are written by hand.

Deleting a task removes data. It does not unregister the delete action itself.
Listing tasks is shown as an action to demonstrate the shared execution path;
application code can also call a service directly when no action behavior is needed.

## The application composes and runs the plugin

[plugin.mjs](../examples/todos/plugin.mjs) groups the pieces with `definePlugin`. Services
and actions are records keyed by name, so their IDs become `todos.tasks`, `todos.create`,
`todos.list` and `todos.delete` — the same IDs discovery derives from file paths in an
app. [The entry script](../examples/todos.mjs) calls `createRuntime({ plugins: [todos] })`,
mounts it, executes the scenario, and calls the returned stop function in a `finally`
block. Core coordinates lifecycle; your application decides which operations to invoke.

These JavaScript examples demonstrate runtime behavior. For typed action inputs,
use TypeScript definitions: `defineAction<number>({ ... })` or an `input` schema.
A real app also validates untrusted input and enforces permissions on the server.

## Add UI or persistence later

Keep task operations in the service. A page binds to the named actions with `<Action>`
from `@bitakit/ui` and reads the store with `useServiceState('todos.tasks', ...)`; a
storage implementation can replace the in-memory store. Neither is created by this example.

See [Core introduction](../README.md), [Core reference](reference.md), and
[file discovery conventions](file-contributions.md) for the next steps.
