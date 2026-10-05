<p align="center">
  <img src="https://raw.githubusercontent.com/mvavesal/bitakit/main/docs/assets/readme/bitakit-banner.png" alt="BitaKit — Your app. Your building blocks. An AI-friendly composition layer for modern applications." width="1024">
</p>

# BitaKit Core

**Build bigger apps from smaller, pluggable features — together with your team and AI.**

BitaKit gives **developers and AI coding assistants a shared structure** for building
applications. Organize a feature into a plugin, put behavior and state in services,
and expose operations through actions. Each piece has a clear home, a clear role,
and typed connections to the rest of your app.

**Keep Next.js, TanStack Start, or your own stack.** BitaKit adds feature organization
and shared lifecycle management alongside your framework. You keep control of your
routes, UI, business rules, and data.

## Start with one service

In a discovery-enabled app, `src/plugins/counter/services/value.ts` needs only:

```ts
import { defineService } from '@bitakit/core';
export default defineService(({ store }) => {
  const state = store({ count: 0 });
  return { state, increment: () => state.set((s) => ({ count: s.count + 1 })) };
});
```

The service is `counter.value`. You can now add an Action and a page through the
[step-by-step Counter guide](../../apps/docs/content/docs/concepts/services.mdx).
Resource hooks, contracts and runtime management are optional topics below.

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

- **Smaller pieces. Clearer ownership.** Keep a feature's services, actions and events
  together in a plugin. Teams can work on focused parts of the app with explicit
  connections between them.
- **A shared language for humans and AI.** Predictable files and typed contracts make
  it easier to describe a change, give an AI assistant focused context, and review
  its work. The same conventions guide both developers and coding assistants.
- **Pluggable features.** Compose the capabilities your app needs. Add a plugin,
  configure its defaults, or cap its actions through the same APIs.
- **Less repeated wiring.** With discovery configured, file paths supply names and
  generated types. Core handles startup, dependencies, registration, and cleanup.
- **Type-safe connections.** Service methods, action inputs and results, event payloads
  and configuration carry their types to callers. Your editor helps you connect the pieces.
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
          ├── Service: holds tasks in a store and provides create/list/delete
          ├── Events: announces "todos.changed" to other plugins
          └── Action: calls the service to add a task

Button or server code
    │ executes "todos.create"
    ▼
Action ──calls──▶ To-do service ──returns──▶ Task

Application UI displays the result; Core does not render it.
```

| Concept          | What it does                                                        | In this example                                   |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| **Plugin**       | Bundles the parts of a feature. The folder name is its ID.          | The To-do feature, `todos`.                       |
| **Service**      | Owns behavior and observable state (`store()`).                     | Stores tasks and exposes `create()` and `list()`. |
| **Action**       | Provides a named operation that application code or UI can execute. | `todos.create` adds a task through the service.   |
| **Events**       | Typed notifications a plugin declares once and emits itself.        | `todos.changed` after every mutation.             |
| **Core runtime** | Coordinates dependencies, registrations, startup, and cleanup.      | Creates the service and registers the actions.    |

Core manages the lifecycle of plugin-created services. A service registers `onStart` and
`onStop` hooks when it acquires resources. Core does not save data to a database for
you; `store()` is in-memory state that actions and UI follow automatically.

## Lifecycle

```ts
const runtime = createRuntime(config);
const stop = runtime.mount();
try {
  await runtime.ready; /* use the runtime */
} finally {
  await stop();
}
```

Stop cancels owned Actions and awaits startup, running Actions and reverse-order cleanup.
It is idempotent and rejects with aggregated cleanup errors after all disposers run.
`runtime.lifecycle.get()` and `.watch(listener)` expose retained plugin/service readiness
and cleanup status. The existing bus emits `runtime.lifecycle` for transition observers.

`createRuntimeController(config, { failures: 'isolate' })` adds the same startup isolation
policy React uses; the default is `fail-fast`. Isolation fully stops and rebuilds the
remaining composition, blocking explicit dependents and required-service consumers.
React waits for old cleanup before replacement. Failed cleanup prevents automatic restart.
Do not await the enclosing runtime's stop from its own hooks or Actions.

Optional service access uses `app.has(name)` before reading; a missing direct read throws,
including `auth` and `i18n`. See the [lifecycle contract](../../docs/target-api.md#lifecycle-completion-and-host-policy).

## Try a To-do plugin

Follow the [To-do tutorial](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/docs/todo-tutorial.md) to run three actions: create a
task, list tasks, and delete a task. Each action lives in its own file:

```text
examples/
├── todos.mjs                  # Starts the runtime and executes the actions
└── todos/
    ├── plugin.mjs             # Groups the service, the events and the actions
    ├── events.mjs             # todos.changed
    ├── services/
    │   └── tasks.mjs          # In-memory task store and operations
    └── actions/
        ├── create.mjs         # todos.create
        ├── list.mjs           # todos.list
        └── delete.mjs         # todos.delete — disabled while the list is empty
```

The plugin uses explicit imports, so no framework or discovery setup is required.
The script creates two tasks, shows that the delete action became enabled, lists them,
deletes the second, and lists the remaining task. Stopping the runtime releases its
registrations. Data stays in memory and is lost on restart.

With a configured framework adapter, the same files live under
`src/plugins/todos/services`, `src/plugins/todos/actions` and `src/plugins/todos/events.ts`,
and the build generates registration and types. Installing Core alone does not scan
folders. See [file contributions](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/docs/file-contributions.md) for the exact conventions.

## Type safety that follows your feature

Define a service once, then use its method types wherever you call it as
`services.<plugin>.<file>`. Discovery connects supported files to typed service access,
action IDs, event names and configuration. Shared contracts (`defineContract`) let
separate packages agree on the same service type.

```ts
// src/plugins/todos/actions/create.ts
import { defineAction } from '@bitakit/core';
import { z } from 'zod';

export default defineAction({
  title: 'Add a task',
  input: z.string().min(1), // validates and types the input; disabled while invalid
  execute: ({ services, input }) => services.todos.tasks.create(input),
});
```

Without a schema, name the input type: `defineAction<string>({ ... })`. Event names and
payloads come from each plugin's `events.ts`, config types from `configs/`. Unknown
action IDs are rejected at compile time in generated apps. TypeScript checks code;
validate external data and authorize requests at your application boundaries.
See the [Core reference](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/docs/reference.md)
for examples.

## State and events

A service keeps its state in a `store()`. Actions that read it in a function-valued
field such as `enabled` are re-evaluated when it changes, and React pages follow it with
`useServiceState`. Events announce a change to other plugins.

```ts
// src/plugins/todos/services/tasks.ts
import { defineService } from '@bitakit/core';

export default defineService(({ store, events }) => {
  const state = store<{ items: { id: number; title: string }[] }>({ items: [] });
  return {
    state,
    list: () => [...state.get().items],
    add(title: string) {
      const todo = { id: Date.now(), title };
      state.set((s) => ({ items: [...s.items, todo] }));
      events.emit('todos.changed', { kind: 'added', id: todo.id });
    },
    remove(id: number) {
      state.set((s) => ({ items: s.items.filter((todo) => todo.id !== id) }));
      events.emit('todos.changed', { kind: 'removed', id });
    },
  };
});
```

```ts
// src/plugins/todos/events.ts
import { defineEvents, event } from '@bitakit/core';

// Emitted and observed as "todos.changed". Only the todos plugin may emit it.
export default defineEvents({
  changed: event<{ kind: 'added' | 'removed'; id: number }>(),
});
```

```ts
// src/plugins/todos/actions/delete.ts
import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Delete',
  // Re-evaluated whenever the tasks store changes: disabled while the list is empty.
  enabled: ({ services }) => services.todos.tasks.state.get().items.length > 0,
  // Runs when a bound control or your code executes the action.
  execute: ({ services, input }) => services.todos.tasks.remove(input),
});
```

Discovery supplies `todos.tasks` and `todos.delete` from the paths. Other plugins react
with `events.on('todos.changed', ({ data }) => ...)` inside a service, and React
components use `useEvent` from `@bitakit/ui`. Core owns every subscription and releases it
with the service, the component or the runtime.

See [events](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/docs/events.md) for
payload typing, cancelable events, errors and async handlers.

## Settings

```ts
// src/plugins/todos/settings.ts — no React, shared with the server later
import { defineSettings, setting } from '@bitakit/core';

export default defineSettings(
  {
    pageSize: setting({ default: 20, control: 'number', label: 'Items per page' }),
    showDone: setting({ default: true, scope: 'device' }),
  },
  { title: 'Todos', category: 'general' },
);
```

Keys are `<plugin>.<name>`; every context reads and writes them through typed handles
(`settings.todos.pageSize.get()`, `set()`, `subscribe()`), React through `useSetting`. The
runtime owns the values, follows the `auth` contract for the user and organization identity,
re-evaluates action presentation on changes and persists through the `settings.storage`
contract: browser storage by default, or one service with `provides: settingsStorage`.

## What belongs outside Core?

- **React rendering:** the UI bindings and your visual components.
- **Routes and navigation:** your application's router and its BitaKit adapter.
- **Discovery:** the Node-only folder scanner and generator is `@bitakit/discovery`, so Core carries
  no `typescript` or `jiti` dependency; `@bitakit/core/discovery` re-exports it for one release.
- **Settings UI:** Core declares (`defineSettings`), owns and persists setting values through
  the `settings.storage` contract; the pages that show them are the App Preferences package.
- **Email, authentication, and persistence:** optional integrations or your own services.

Plugins are trusted application code. Core is not a sandbox or a remote plugin marketplace.

## Go deeper

- [Runnable To-do example](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/examples/todos.mjs)
- [Core reference](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/docs/reference.md): the define helpers, runtime, feedback, typed access, testing and advanced integration.
- [File contributions and configuration](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/docs/file-contributions.md): discovery and folder conventions.
- [Client authentication](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/docs/auth.md): the shared provider contract, externally configured login/logout paths, UI bindings and an adapter template.
- [npm package](https://www.npmjs.com/package/@bitakit/core)

## License

[MIT](https://cdn.jsdelivr.net/npm/@bitakit/core@0.2.0/LICENSE). Third-party dependencies retain their own licenses.

## Slot contracts

```ts
import { createRuntime, definePlugin, defineSlot } from '@bitakit/core';

const shell = definePlugin({
  id: 'shell',
  slots: {
    header: { actions: defineSlot({ accepts: 'actions' }) },
    logo: defineSlot({ accepts: 'component', policy: 'single' }),
  },
});
const runtime = createRuntime({ plugins: [shell] });
// runtime.modules[1].slots: shell.header.actions and shell.logo, owned by shell.
```

`slots/` files and manual nested/dotted records produce the same immutable contracts.
Use `payload` for owner context; data slots require `schema`. Existing zod/Standard Schema
support supplies `SlotPayload`/`SlotData` types. App-root names are plain, explicit IDs absolute,
and arrays require IDs. Duplicate declarations fail with owner/source information.
`list` (default), `single` and `keyed` are enforced at attachment, including pending entries.
Conflicts never silently replace. A declaration does not activate or render a slot.

```ts
// Inside definePlugin({ setup: ({ app }) => { ... } }):
const placement = app.slots.attach(
  'shell.header.actions',
  {
    actionId: 'editor.save',
    order: 10,
  },
  { availability: 'wait' },
);
app.slots.watch('shell.header.actions', (state) => console.log(state.phase));
// Automatic cleanup with the contributor; placement.dispose() removes it early.
```

Default `require` rejects unavailable owners; `wait` accepts known definitions and attaches
when owner and contributor are ready. Unknown names always fail. Both policies follow later
availability. `get/subscribe/watch` retain current state; `placement.ready` resolves on first
attachment and rejects on invalid data or early disposal. `runtime.slots` is the host read API.
The existing `runtime.slot` event announces updates, but is not the readiness source of truth.
Data uses the declared schema; Action IDs refer to existing public Actions. Component values
stay opaque in Core. Declared `ui.slots` use the same owned path. Live declaration mutation requires composition replacement. Actions declare placements with
`slots`; App Preferences projects Settings through these same attachments.

Action definitions support explicit `slots` (names or `{ name, input, order, key, availability }` placements). Each placement is an owned reference to the one ActionList entry; `groups` remains logical membership. Core stores opaque content and input mappers; React outlet validation and rendering live in UI.

Slot contributions may carry a pure `when({ payload })` presentation predicate. Core retains it;
outlets evaluate it after payload validation. It does not change attachment state. Settings page
metadata may carry an opaque `boundary` component, interpreted by the optional settings UI.
`scopeLifecycle(scope)` exposes existing read-only lifecycle status to projections and revokes
its observers when the runtime-issued scope closes; it adds no lifecycle mutation operation.

## Targeted host updates and inspection

```ts
import { inspectRuntime } from '@bitakit/core';

const result = await runtime.reconcilePlugins(nextPlugins);
if (result.status === 'restart-required') console.log(result.reasons);
const inventory = inspectRuntime(runtime); // version: 1, static + live
```

The host passes immutable already-loaded definitions, preserving unchanged object references.
Supported implementation/Action/page changes stop and restart their dependency closure while
unrelated services retain identity/state. Plugin membership, service identities/dependencies,
foundational contracts and provider/installer/interceptor owners need composition replacement.
Updates report `applied`, `blocked`, `failed` or `restart-required`. A clean startup failure can
be retried explicitly; failed cleanup blocks reuse. Invoke outside owned work and await the
result, not the initial `ready` promise. `isReady()` retains initial startup readiness through
targeted updates; `isReady(pluginId)` and `isServiceReady(name)` report owner availability.
`app.has(name)` uses service readiness; `hasService(name)` is raw container presence for cleanup.
Inspect lifecycle/result for update success. Unaffected React UI stays mounted; affected
owners (including composition readers) can remount. This is not file HMR or package installation.

`observeRuntimeInventory(runtime)` supplies cached `get`/`subscribe` snapshots. Values, defaults,
callbacks, components and raw failures are excluded; public metadata and declaration sources
remain visible. Static CLI inspection uses the same schema with `live: null` and unresolved
fields set to null. See [exact update and inventory contracts](../../docs/target-api.md#host-driven-plugin-updates).
