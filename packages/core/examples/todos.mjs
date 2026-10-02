import { createRuntime } from '@bitakit/core';
import todos from './todos/plugin.mjs';

const runtime = createRuntime({ plugins: [todos] });
const { actions } = runtime;
const stop = runtime.mount();

try {
  console.log('Delete enabled before:', actions.get('todos.delete').enabled);
  await actions.execute('todos.create', 'Learn plugins');
  await actions.execute('todos.create', 'Connect a service');
  console.log('Delete enabled after:', actions.get('todos.delete').enabled);
  console.log('Before:', (await actions.execute('todos.list')).value);
  await actions.execute('todos.delete', 2);
  console.log('After:', (await actions.execute('todos.list')).value);
} finally {
  stop();
}
