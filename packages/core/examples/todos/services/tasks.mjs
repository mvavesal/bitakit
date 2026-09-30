import { defineService } from '@bitakit/core';

function createTodoService() {
  let tasks = [];
  let nextId = 1;

  function create(title) {
    const task = { id: nextId++, title, done: false };
    tasks.push(task);
    return task;
  }

  return {
    create,
    list: () => [...tasks],
    delete(id) {
      const previousCount = tasks.length;
      tasks = tasks.filter((task) => task.id !== id);
      return tasks.length < previousCount;
    },
  };
}

export default defineService({
  id: 'todos',
  create: createTodoService,
});
