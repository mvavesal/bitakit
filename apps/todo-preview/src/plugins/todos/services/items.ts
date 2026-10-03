import { authService, defineService, getService } from '@bitakit/core';

export type Item = { id: string; title: string; completed: boolean };

export default defineService(({ store, services, onStart, onStop }) => {
  const auth = getService(services, authService);
  const state = store({ items: [] as Item[], pending: false, error: '', organizationId: '' });
  let revision = 0;
  let identity = '';
  let clearTarget: { identity: string; revision: number; organizationId: string } | undefined;
  const current = () => {
    const snapshot = auth.getSnapshot();
    return `${snapshot.user?.id ?? ''}:${snapshot.organizationId ?? ''}`;
  };
  async function load() {
    const run = ++revision;
    const snapshot = auth.getSnapshot();
    const organizationId = snapshot.organizationId ?? '';
    state.set({ items: [], error: '', organizationId, pending: Boolean(snapshot.user && organizationId) });
    if (!snapshot.user || !organizationId) return;
    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as { items: Item[] };
      if (run === revision) state.set((value) => ({ ...value, items: data.items, pending: false }));
    } catch (error) {
      if (run === revision) state.set((value) => ({ ...value, pending: false, error: error instanceof Error ? error.message : 'Could not load tasks.' }));
    }
  }
  onStart(() => {
    identity = current();
    const stop = auth.subscribe(() => {
      const next = current();
      if (next !== identity) { identity = next; void load(); }
    });
    onStop(() => { ++revision; stop(); });
    return load();
  });
  async function change(body: Record<string, unknown>) {
    const started = current();
    const response = await fetch('/api/tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { items: Item[] };
    if (current() === started) state.set((value) => ({ ...value, items: data.items, error: '' }));
  }
  return {
    state,
    add: (title: string) => change({ operation: 'add', title }),
    edit: (id: string, title: string) => change({ operation: 'edit', id, title }),
    complete: (id: string, completed: boolean) => change({ operation: 'complete', id, completed }),
    remove: (id: string) => change({ operation: 'remove', id }),
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
      return change({ operation: 'clear', organizationId: target.organizationId });
    },
  };
}, { requires: [authService] });
