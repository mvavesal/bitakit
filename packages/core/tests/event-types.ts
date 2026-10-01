import { EventService, defineAction, defineService } from '../src/core.js';
declare module '../src/core.js' {
  interface EventMap {
    'todos.changed': { id: number };
    'todos.loaded': undefined;
  }
}
const events = new EventService();
events.emit('todos.changed', { id: 1 });
events.emit('todos.loaded');
// @ts-expect-error Known payloads are required.
events.emit('todos.changed');
// @ts-expect-error Known payloads must match their declaration.
events.emit('todos.changed', { id: 'wrong' });
events.watch(['todos.loaded', 'todos.changed'], (event) => {
  if (event.type === 'todos.changed') {
    const id: number = event.data.id;
    void id;
  }
});
defineAction({
  setup({ action, events }) {
    events.watch('todos.changed', async (event, { signal }) => {
      action.enabled = event.data.id > 0 && !signal.aborted;
      // @ts-expect-error Presentation state remains typed.
      action.enabled = 'yes';
    });
  },
});
defineService({ create: ({ events }) => ({ changed: () => events.emit('todos.loaded') }) });

defineAction({
  events: ['todos.changed', 'todos.loaded'],
  onEvent(event, { action, signal }) {
    if (event.type === 'todos.changed') {
      const id: number = event.data.id;
      action.enabled = id > 0 && !signal.aborted;
      // @ts-expect-error Event payload is inferred from the declared names.
      const wrong: string = event.data.id;
      void wrong;
    }
  },
});
