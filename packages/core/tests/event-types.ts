import {
  EventService,
  defineEvents,
  defineService,
  event,
  type CancelableOf,
  type EventsOf,
} from '../src/core.js';

// A plugin declares its events once; the generated maps are derived from that declaration.
const todos = defineEvents({
  changed: event<{ id: number }>(),
  loaded: event(),
  deleting: event<{ id: number }>({ cancelable: true }),
  tagged: event({ schema: { parse: (input: unknown) => String(input) } }),
});
type TodoEvents = EventsOf<typeof todos, 'todos'>;
type TodoCancelable = CancelableOf<typeof todos, 'todos'>;
const declared: TodoEvents = {
  'todos.changed': { id: 1 },
  'todos.loaded': undefined,
  'todos.deleting': { id: 2 },
  'todos.tagged': 'x',
};
const cancelable: TodoCancelable = { 'todos.deleting': true };
// @ts-expect-error Only cancelable events appear in the cancelable map.
const notCancelable: TodoCancelable = { 'todos.changed': true };
declare module '../src/core.js' {
  interface EventMap extends EventsOf<typeof todos, 'todos'> {}
  interface CancelableEventMap extends CancelableOf<typeof todos, 'todos'> {}
}

const events = new EventService();
events.emit('todos.changed', { id: 1 });
events.emit('todos.loaded');
// @ts-expect-error Known payloads are required.
events.emit('todos.changed');
// @ts-expect-error Known payloads must match their declaration.
events.emit('todos.changed', { id: 'wrong' });
const plain: void = events.emit('todos.changed', { id: 2 });
const allowed: Promise<boolean> = events.emit('todos.deleting', { id: 1 });
// @ts-expect-error A plain event does not return a promise.
const wrongResult: Promise<boolean> = events.emit('todos.loaded');
events.emit('custom.unknown', { anything: true });

events.on(['todos.loaded', 'todos.changed'], (event, { signal }) => {
  if (event.type === 'todos.changed') {
    const id: number = event.data.id;
    void [id, signal.aborted];
  }
});
events.on('todos.*', (event) => {
  const type: 'todos.changed' | 'todos.loaded' | 'todos.deleting' | 'todos.tagged' = event.type;
  if (event.type === 'todos.deleting') event.cancel?.();
  void type;
});
events.on('*', (event) => {
  const type: string = event.type;
  void type;
});
const stop: () => void = events.on('todos.changed', async (event) => {
  // @ts-expect-error Payloads are typed from the declaration.
  const wrong: string = event.data.id;
  void wrong;
});

// Services emit through the same typed interface and own observable state through store().
const service = defineService(({ events, store }) => {
  const state = store({ count: 0 });
  return {
    state,
    reload: () => events.emit('todos.loaded'),
    rename: () => events.emit('todos.changed', { id: state.get().count }),
    // @ts-expect-error Store values are typed once.
    broken: () => state.set({ count: 'many' }),
  };
});
void [declared, cancelable, notCancelable, plain, allowed, wrongResult, stop, service];
