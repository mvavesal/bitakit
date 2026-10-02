# Events

Each `FoundationRuntime` owns one event bus, available as `runtime.events` and `app.events`.
Service factories receive a scoped `events` view; so does every action's `execute`. There
is no global bus, React dependency, replay buffer, persistence, or cross-process delivery.

Use a **store** when something inside the plugin should follow state: actions re-evaluate
their function-valued fields and `useServiceState` re-renders on every store change. Use
an **event** to tell other plugins that something happened.

## Declare

A plugin declares its events once, in `events.ts`:

```ts
// src/plugins/todos/events.ts
import { defineEvents, event } from '@bitakit/core';

export default defineEvents({
  changed: event<{ kind: 'added' | 'removed'; id: number }>(),
  deleting: event<{ id: number }>({ cancelable: true }),
  loaded: event(), // no payload
});
```

Names are prefixed with the plugin ID: `changed` is emitted and observed as
`todos.changed`. Event names use letters, digits, `_` and `-` without dots. Discovery adds
the declarations to the generated `EventMap`, so `emit`, `on` and `useEvent` know the
payload of every declared event. `event({ schema })` additionally validates payloads with a
`parse` function at emit time.

Only the declaring plugin may emit its events. Another plugin that calls
`events.emit('todos.changed', ...)` gets an error that names the owner. Names nobody
declared may still be emitted with an `unknown` payload, so independent plugins can
participate without a central registry; declare them to get types and ownership.

## Emit and listen

```ts
// inside a service factory or an action's execute
events.emit('todos.changed', { kind: 'added', id: 42 }); // void

events.on('todos.changed', ({ data }) => {
  console.log(data.kind, data.id);
});
events.on(['todos.changed', 'todos.loaded'], (event) => {
  // event is a discriminated { type, data } union
});
events.on('todos.*', ({ type }) => {}); // every todos event; '*' matches all events
```

Emit after the source data has changed. `on` returns an idempotent unsubscribe function;
subscriptions made in a service factory are released with the service, and the runtime
releases everything else when it stops. Callbacks may emit further events synchronously,
so avoid cycles.

### Cancelable events

A `cancelable: true` event asks before something happens. `emit` then waits for every
handler and resolves to `false` when one of them cancelled:

```ts
async delete(id: number) {
  const allowed = await events.emit('todos.deleting', { id });
  if (!allowed) return false;
  state.set((s) => ({ items: s.items.filter((todo) => todo.id !== id) }));
  events.emit('todos.changed', { kind: 'removed', id });
  return true;
}

events.on('todos.deleting', (event) => {
  if (event.data.id === 1) event.cancel?.('The first task stays.');
});
```

## Delivery, errors and cancellation

`emit` delivers synchronously in registration order. An async handler starts immediately;
the emitter does not await it (except for cancelable events). Handlers can overlap; there
is no serialization or latest-request-wins behavior.

Both synchronous throws and promise rejections go to
`FoundationConfig.onEventError(error, event)`. The default reports to `console.error`.
One failing handler does not prevent other handlers from receiving the event.

Each subscription supplies an `AbortSignal`, aborted when unsubscribed. Pass it to
abort-aware operations and check it before external side effects after `await`:

```ts
events.on('documents.reload', async (event, { signal }) => {
  const response = await fetch('/api/documents', { signal });
  const documents = await response.json();
  if (!signal.aborted) updateDocuments(documents);
});
```

Unsubscription cannot forcibly cancel arbitrary JavaScript or undo side effects.

## Typed payloads without discovery

In a manual composition, augment the shared maps yourself. This does not register
anything at runtime:

```ts
declare module '@bitakit/core' {
  interface EventMap {
    'todos.changed': { kind: 'added' | 'removed'; id: number };
    'todos.deleting': { id: number };
  }
  interface CancelableEventMap {
    'todos.deleting': true;
  }
}
```

Known events require matching payloads; unknown names stay allowed with `unknown` data.

## React

```ts
import { useEvent } from '@bitakit/ui';

useEvent('todos.changed', (event) => {
  // React to event.type and event.data.
});
```

The hook subscribes once the runtime is ready, follows the latest callback, and
unsubscribes when the names or the runtime change or the component unmounts. Inline name
arrays do not resubscribe when their contents stay the same. Events emitted before the
subscription are not replayed; read state with `useServiceState` for initial rendering.
`useWatchEvent` is a deprecated alias of `useEvent`.

## Testing

`mountPlugin()` from `@bitakit/core/testing` records every event emitted while mounted in
`plugin.events.recorded`, so a test can assert `recorded.some((event) => event.type === 'todos.changed')`.
