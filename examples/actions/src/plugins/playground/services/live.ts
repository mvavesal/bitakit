import { defineService } from '@bitakit/core';

/** Where a live Action can show, besides the example's own card. */
export const places = [
  { value: 'toolbar', label: 'App bar' },
  { value: 'navigation', label: 'Sidebar' },
  { value: 'sidebar-footer', label: 'Sidebar footer' },
  { value: 'page-top', label: 'Above the page' },
] as const;
export type Place = (typeof places)[number]['value'];

/** The icons a live Action can show; ui/live-icon.tsx draws them. */
export const icons = ['star', 'heart', 'rocket', 'bell'] as const;
export type Icon = (typeof icons)[number];

export type LiveAction = {
  places: Place[];
  title: string;
  tooltip: string;
  icon: Icon;
  enabled: boolean;
};

/** As many live Actions as actions/live/ declares (first to fourth). */
export const capacity = 4;

// The live Actions you add in the first example, and which one you edit. The Actions in
// actions/live/ read their entry here; the editor's Actions change the selected entry.
export default defineService(({ store }) => {
  const state = store({ actions: [] as LiveAction[], selected: 0 });
  return {
    state,
    /** The entry being edited, if any. */
    selected: () => state.get().actions[state.get().selected],
    add: () =>
      state.set((current) => {
        const n = current.actions.length;
        if (n >= capacity) return current;
        const action: LiveAction = {
          places: ['toolbar'],
          title: `Action ${n + 1}`,
          tooltip: '',
          icon: icons[n % icons.length],
          enabled: true,
        };
        return { actions: [...current.actions, action], selected: n };
      }),
    remove: () =>
      state.set((current) => {
        const actions = current.actions.filter((_, index) => index !== current.selected);
        return { actions, selected: Math.max(0, Math.min(current.selected, actions.length - 1)) };
      }),
    select: (index: number) => state.set((current) => ({ ...current, selected: index })),
    update: (patch: Partial<LiveAction>) =>
      state.set((current) => ({
        ...current,
        actions: current.actions.map((action, index) =>
          index === current.selected ? { ...action, ...patch } : action,
        ),
      })),
  };
});
