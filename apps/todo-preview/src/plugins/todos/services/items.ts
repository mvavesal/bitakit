import { authService, defineService, getService } from '@bitakit/core';

export type Item = { id: string; title: string; completed: boolean };

export default defineService(
  ({ store, services, remote, onStart, onStop }) => {
    const auth = getService(services, authService);
    const state = store({ items: [] as Item[], pending: false, error: '', organizationId: '' });
    let revision = 0;
    let identity = '';
    let clearTarget: { identity: string; revision: number; organizationId: string } | undefined;
    const current = () => {
      const snapshot = auth.getSnapshot();
      return `${snapshot.user?.id ?? ''}:${snapshot.organizationId ?? ''}`;
    };
    /** Reads the current organization's tasks from the server (todos.list). */
    async function read(signal?: AbortSignal): Promise<Item[]> {
      const snapshot = auth.getSnapshot();
      if (!snapshot.user || !snapshot.organizationId) return [];
      const started = current();
      const { items } = await remote.todos.list(undefined, {
        signal,
        organizationId: snapshot.organizationId,
      });
      signal?.throwIfAborted();
      return current() === started ? items : [];
    }
    async function load() {
      const run = ++revision;
      const snapshot = auth.getSnapshot();
      const organizationId = snapshot.organizationId ?? '';
      state.set({
        items: [],
        error: '',
        organizationId,
        pending: Boolean(snapshot.user && organizationId),
      });
      if (!snapshot.user || !organizationId) return;
      try {
        const items = await read();
        if (run === revision) state.set((value) => ({ ...value, items, pending: false }));
      } catch (error) {
        if (run === revision)
          state.set((value) => ({
            ...value,
            pending: false,
            error: error instanceof Error ? error.message : 'Could not load tasks.',
          }));
      }
    }
    onStart(() => {
      identity = current();
      const stop = auth.subscribe(() => {
        const next = current();
        if (next !== identity) {
          identity = next;
          void load();
        }
      });
      onStop(() => {
        ++revision;
        stop();
      });
      // Readiness does not wait for the network; the page shows `pending` while tasks load.
      void load();
    });
    /**
     * Runs one operation for the organization the list was loaded under (the server answers
     * CONFLICT once the session has moved to another one) and shows the list it answers, unless
     * the account or organization changed meanwhile.
     */
    async function change(
      operation: (options: { organizationId: string }) => Promise<{ items: Item[] }>,
    ) {
      const started = current();
      const { items } = await operation({ organizationId: state.get().organizationId });
      if (current() === started) state.set((value) => ({ ...value, items, error: '' }));
    }
    return {
      state,
      read,
      add: (title: string) => change((options) => remote.todos.add({ title }, options)),
      edit: (id: string, title: string) =>
        change((options) => remote.todos.edit({ id, title }, options)),
      complete: (id: string, completed: boolean) =>
        change((options) => remote.todos.complete({ id, completed }, options)),
      remove: (id: string) => change((options) => remote.todos.remove({ id }, options)),
      confirmClear() {
        const value = state.get();
        clearTarget = { identity: current(), revision, organizationId: value.organizationId };
        return {
          title: 'Clear all tasks?',
          description: `Delete all ${value.items.length} tasks in the selected organization. This cannot be undone.`,
          destructive: true,
        };
      },
      clear() {
        const target = clearTarget;
        clearTarget = undefined;
        if (!target || target.identity !== current() || target.revision !== revision)
          throw new Error('The account or organization changed. Confirm again to clear its tasks.');
        const { organizationId } = target;
        return change(() => remote.todos.clear({ organizationId }, { organizationId }));
      },
    };
  },
  { requires: [authService] },
);
