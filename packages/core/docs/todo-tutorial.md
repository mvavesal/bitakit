# Build your first To-do plugin

Create three tasks, list them, and delete one. This example shows how separate
**actions** share one **service**, grouped by a **plugin**. No UI or database is needed.

## Run the complete example

Use Node.js 24 in a new folder:

```sh
npm init -y
npm install @bitakit/core
```

Download or copy [todos.mjs](../examples/todos.mjs) and the entire
[todos folder](../examples/todos), preserving their relative paths. The walkthrough
uses explicit imports; these files do not require a discovery-enabled host.

```text
my-example/
├── package.json
├── todos.mjs
└── todos/
    ├── plugin.mjs
    ├── services/
    │   └── tasks.mjs
    └── actions/
        ├── create.mjs
        ├── list.mjs
        └── delete.mjs
```

Run `node todos.mjs`. The first result contains three tasks. The second contains
only tasks 1 and 3, because the script deleted task 2. Each action execution returns
an outcome; successful execution has `status: 'completed'` and its result in `value`.

## The service owns the task behavior

[The task service](../examples/todos/services/tasks.mjs) stores tasks in an array and
exposes `create(title)`, `list()`, and `delete(id)`. Its factory runs when Core mounts
the runtime. IDs increase independently of list length, so deletion does not cause
ID reuse. This is temporary memory, not database persistence.

## Three actions, one service

| Action                                               | Input      | Service operation | Successful result          |
| ---------------------------------------------------- | ---------- | ----------------- | -------------------------- |
| [todos.create](../examples/todos/actions/create.mjs) | Task title | `create(title)`   | Created task               |
| [todos.list](../examples/todos/actions/list.mjs)     | None       | `list()`          | Current tasks              |
| [todos.delete](../examples/todos/actions/delete.mjs) | Task ID    | `delete(id)`      | Whether a task was removed |

Each action declares `requires: ['todos']`. The action context supplies the service
and the caller's `input`. The plugin imports these definitions and contributes them
to the same runtime; they do not create separate service instances.

```text
create action ──┐
list action   ──┼──▶ task service ──▶ shared in-memory tasks
delete action ──┘
```

Deleting a task removes data. It does not unregister the delete action itself.
Listing tasks is shown as an action to demonstrate the shared execution path;
application code can also call a service directly when no action behavior is needed.

## The application composes and runs the plugin

[The entry script](../examples/todos.mjs) creates one ActionList and runtime, mounts
the plugin, executes the scenario, and calls cleanup in a `finally` block. Core
coordinates lifecycle; your application decides which operations to invoke.

These JavaScript examples demonstrate runtime behavior. For typed action inputs,
use TypeScript definitions and the documented generated or explicit action contracts.
A real app also validates untrusted input and enforces permissions on the server.

## Add UI or persistence later

Keep task operations in the service. A UI can bind to the named actions through the
React package; a storage implementation can replace the in-memory behavior. Neither
is automatically created by this example.

See [Core introduction](../README.md), [Core reference](reference.md), and
[file discovery conventions](file-contributions.md) for the next steps.
