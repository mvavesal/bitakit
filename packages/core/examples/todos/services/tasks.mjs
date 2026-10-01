import { defineService } from '@bitakit/core';

function createTodoService({ events }) {
  let tasks = [];
  let nextId = 1;

  function create(title) {
    const task = { id: nextId++, title, done: false };
    tasks.push(task);
    events.emit('todos.changed', { kind: 'added', id: task.id });
    return task;
  }

  return {
    create,
    list: () => [...tasks],
    delete(id) {
      const previousCount = tasks.length;
      tasks = tasks.filter((task) => task.id !== id);
      const removed = tasks.length < previousCount;
      if (removed) events.emit('todos.changed', { kind: 'removed', id });
      return removed;
    },
  };
}

export default defineService({
  id: 'todos',
  create: createTodoService,
});
