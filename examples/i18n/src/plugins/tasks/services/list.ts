import { defineService } from '@bitakit/core';

export type Task = { id: number; title: string; done: boolean; added: string };

// The tasks of this visit, in memory. Task titles are user content: they are never translated.
export default defineService(({ store }) => {
  const state = store<{ tasks: Task[] }>({ tasks: [] });
  let next = 1;
  return {
    state,
    add(title: string) {
      const task = { id: next++, title, done: false, added: new Date().toISOString() };
      state.set((current) => ({ tasks: [...current.tasks, task] }));
    },
    toggle: (id: number) =>
      state.set((current) => ({
        tasks: current.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
      })),
    clearDone: () =>
      state.set((current) => ({ tasks: current.tasks.filter((task) => !task.done) })),
  };
});
