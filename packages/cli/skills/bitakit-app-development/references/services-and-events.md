# Services and events

Use a service when a feature owns state or logic that pages, Actions and other plugins share.
Use an event when the owning plugin must tell other plugins that something happened.

## Add a service

`npx bitakit add service todos/list` creates `src/plugins/todos/services/list.ts`. The path
names the service `todos.list`; a nested `services/archive/list.ts` would be `todos.archive.list`.

```ts
import { defineService } from '@bitakit/core';

export type Todo = { id: number; title: string };

// The todo list. It lives in memory, so a reload starts empty; call your API here later.
export default defineService(({ store, events }) => {
  const state = store<{ todos: Todo[] }>({ todos: [] });
  let next = 1;
  return {
    state,
    add(title: string) {
      const todo = { id: next++, title: title.trim() };
      state.set((current) => ({ todos: [...current.todos, todo] }));
      events.emit('todos.changed', { kind: 'added', title: todo.title });
    },
    remove(id: number) {
      const removed = state.get().todos.find((todo) => todo.id === id);
      state.set((current) => ({ todos: current.todos.filter((todo) => todo.id !== id) }));
      if (removed) events.emit('todos.changed', { kind: 'removed', title: removed.title });
    },
    clear() {
      state.set({ todos: [] });
      events.emit('todos.changed', { kind: 'cleared' });
    },
  };
});
```

- The factory receives `{ store, events, services, settings, config, onStart, onStop }` and
  returns the instance. Destructure only what it uses.
- Return the store as `state`. Actions and `useServiceState` follow it automatically; the
  service never notifies anyone by hand.
- `state.get()` reads. `state.set(next)` or `state.set((current) => next)` replaces the whole
  value, so build new arrays and objects.
- `store()` is memory only: a reload starts empty. To persist, load in
  `onStart(async ({ signal }) => ...)` and save inside the methods through the app's own API.
  Release connections in `onStop`.
- Read settings at call time, as Actions do: `settings.todos.limit.get()`.

## Read a service in React

`src/plugins/summary/ui/slots/shell.header.end.tsx` shows the count in the Shell header.
`npx bitakit add slot summary/shell.header.end` writes the same slot as
`ui/slots/shell/header/end.tsx`; see [slots.md](slots.md).

```tsx
'use client';
import { useServiceState } from '@bitakit/ui';

export default function TodoCount() {
  // 0 is shown until the todos plugin is ready.
  const count = useServiceState('todos.list', (state) => state.todos.length, 0);
  return <span className="text-sm text-muted-foreground">{count} todos</span>;
}
```

- `useServiceState(name, selector, fallback)` returns `fallback` until the runtime and the owning
  plugin are ready, then re-renders only when the selected value changes. Select the smallest
  value you need.
- The name is checked against the generated service map, so a typo fails `npm run typecheck`.
- `useService('todos.list')` returns the instance, or `undefined` until it is ready. To run an
  operation from a control, bind its Action (`<Action id="todos.add">`) so pending and disabled
  states come from the Action; see [actions.md](actions.md).
- Hooks need no `requires`: they show the fallback while the owner is starting or missing.

## Use another plugin's service in an Action or service

Actions and services reach every service as `services.<plugin>.<name>`. Here the `print` plugin
enables its toolbar Action only when the list has todos: `src/plugins/print/actions/list.ts`. It
targets the `todos.toolbar` slot, which the todos plugin declares and renders (see
[slots.md](slots.md)).

```ts
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Print list',
  slots: ['todos.toolbar'],
  // Startup reports a missing todos.list service by name instead of failing on the first render.
  requires: ['todos.list'],
  enabled: ({ services }) => services.todos.list.state.get().todos.length > 0,
  execute: () => window.print(),
});
```

- List every service of another plugin in `requires`. Startup and `npx bitakit doctor` then
  report a missing or misspelled name and suggest the right one.
- A service whose factory reads another service lists it in `requires` in the second argument,
  even inside its own plugin: `defineService(factory, { requires: ['todos.list'] })`. That also creates
  `todos.list` first and reports cycles.
- `enabled`, `visible` and `title` functions re-run when `todos.list` changes, so the button
  follows the list.
- For an optional dependency, leave out `requires` and check `app.has('todos.list')` before
  reading; every Action function receives `app`. Reading a missing service throws, and `?.`
  does not prevent that.
- Shared contracts (`defineContract('auth').of<AuthService>()` plus
  `defineService(factory, { provides: authService })`) are for packages where any plugin may
  provide a service such as `auth`. App features use plugin service names as shown here.

## Declare an event

`npx bitakit add events todos` takes only the plugin name and creates
`src/plugins/todos/events.ts`, the plugin's single events file.

```ts
import { defineEvents, event } from '@bitakit/core';

// Tells other plugins what changed; they listen with events.on('todos.changed', ...).
export default defineEvents({
  changed: event<{ kind: 'added' | 'removed' | 'cleared'; title?: string }>(),
});
```

- The plugin ID prefixes each name: `changed` becomes `todos.changed`. Use letters, digits, `_`
  or `-`, without dots.
- `event<T>()` types the payload; `event()` has none. `npm run typecheck` runs `bitakit generate`,
  which adds the new event to the types.
- Emit after the state change, from the declaring plugin only: its services (see `clear()`
  above) or its Actions through `execute: ({ events }) => ...`.
- When another plugin emits `todos.changed`, the runtime throws. That plugin listens instead,
  or the owner adds the event it needs.

## Listen from another plugin

`src/plugins/activity/services/feed.ts` records each change without touching the todos folder.

```ts
import { defineService } from '@bitakit/core';

// Listens to the todos plugin without changing it; the listener ends when this plugin stops.
export default defineService(({ store, events }) => {
  const state = store<{ entries: string[] }>({ entries: [] });
  events.on('todos.changed', ({ data }) => {
    const entry =
      data.kind === 'cleared'
        ? 'Cleared the list'
        : `${data.kind === 'added' ? 'Added' : 'Removed'} "${data.title}"`;
    state.set((current) => ({ entries: [entry, ...current.entries].slice(0, 5) }));
  });
  return { state };
});
```

- Subscribe in the service factory. The runtime removes the listener when the plugin stops;
  `events.on` also returns an unsubscribe function.
- The handler receives `{ type, data }` and `{ signal }`. `events.on` accepts one name, an array
  of names, a prefix such as `'todos.*'`, or `'*'`.
- Events are not replayed. A plugin that starts later reads current data from `todos.list`.
- Delivery is synchronous and async handlers are not awaited, unless the event is declared with
  `event({ cancelable: true })`; then `emit` waits and resolves to `false` if a handler cancelled.
  A failing handler is logged and the other listeners still run.
- In React, `useEvent('todos.changed', ({ data }) => ...)` from `@bitakit/ui` listens while the
  component is mounted and the runtime is ready. To display data, use `useServiceState` instead.
- Listeners live in a service or in `useEvent`; an Action definition does not subscribe.

## Explain it to the user

Name the owner and the contract: "The todos plugin owns the list in its `todos.list` service and
announces changes as `todos.changed`; activity listens to that event, and summary reads the
service, without changing the todos folder." Say where it appears (the todos page, the header
count) and how to try it: add a todo and watch the feed and the count update. Mention that the
list is in memory, so a reload clears it until the app saves it through its own API.
