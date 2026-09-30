import { defineService } from '@bitakit/core';

export default defineService({
  id: 'todos',
  create: () => {
    const tasks = new Map();
    let nextId = 1;
    return {
      create(title) {
        const task = { id: nextId++, title, done: false };
        tasks.set(task.id, task);
        return task;
      },
      list: () => [...tasks.values()],
      delete: (id) => tasks.delete(id),
    };
  },
});
