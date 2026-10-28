import { defineService } from '@bitakit/core';

/** The icons the live Action can show; ui/live-icon.tsx draws them. */
export const icons = ['star', 'heart', 'rocket', 'bell'] as const;
export type Icon = (typeof icons)[number];

/** Where the live Action can sit, besides the live card and the More menu. */
export const places = [
  { value: 'toolbar', label: 'App bar, right' },
  { value: 'header-start', label: 'App bar, left' },
  { value: 'navigation', label: 'Sidebar navigation' },
  { value: 'sidebar-header', label: 'Sidebar header' },
  { value: 'sidebar-footer', label: 'Sidebar footer' },
  { value: 'page-top', label: 'Above the page' },
] as const;
export type Place = (typeof places)[number]['value'];

type State = {
  title: string;
  tooltip: string;
  icon: Icon;
  enabled: boolean;
  visible: boolean;
  place: Place;
  /** True for a few seconds after the place changed: the icon bounces wherever it is. */
  spotlight: boolean;
  clicks: number;
  /** How many sample items are placed, 0 to 3. */
  samples: number;
};

const initial: State = {
  title: 'Live action',
  tooltip: 'Change me in the playground',
  icon: 'star',
  enabled: true,
  visible: true,
  place: 'toolbar',
  spotlight: false,
  clicks: 0,
  samples: 0,
};

// What the live Action shows. Its title, tooltip, icon, enabled and visible read this store;
// the control Actions only change it, and every place that shows the live Action follows.
export default defineService(({ store, onStart }) => {
  const state = store<State>(initial);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const spotlight = () => {
    clearTimeout(timer);
    state.set((current) => ({ ...current, spotlight: true }));
    timer = setTimeout(() => state.set((current) => ({ ...current, spotlight: false })), 3000);
  };
  onStart(({ signal }) => {
    signal.addEventListener('abort', () => clearTimeout(timer));
  });
  return {
    state,
    set: (patch: Partial<Pick<State, 'title' | 'tooltip' | 'icon' | 'enabled' | 'visible'>>) =>
      state.set((current) => ({ ...current, ...patch })),
    /** Moves the live Action and points at its new place. */
    move(place: Place) {
      state.set((current) => ({ ...current, place, visible: true }));
      spotlight();
    },
    spotlight,
    click: () => state.set((current) => ({ ...current, clicks: current.clicks + 1 })),
    addSample: () =>
      state.set((current) => ({ ...current, samples: Math.min(current.samples + 1, 3) })),
    removeSample: () =>
      state.set((current) => ({ ...current, samples: Math.max(current.samples - 1, 0) })),
    reset: () => state.set(initial),
  };
});
