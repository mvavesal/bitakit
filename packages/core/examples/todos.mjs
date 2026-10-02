import { createRuntime } from '@bitakit/core';
import todos from './todos/plugin.mjs';

const runtime = createRuntime({ plugins: [todos] });
const { actions } = runtime;
const stop = runtime.mount();

try {
  await actions.execute('todos.create', 'Learn plugins');
  await actions.execute('todos.create', 'Connect a service');
  await actions.execute('todos.create', 'Try actions');
  console.log('Before:', await actions.execute('todos.list'));
  await actions.execute('todos.delete', 2);
  console.log('After:', await actions.execute('todos.list'));
} finally {
  stop();
}
