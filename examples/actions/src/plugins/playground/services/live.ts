import { defineService } from '@bitakit/core';

/** The icons the live Action can show; ui/live-icon.tsx draws them. */
export const icons = ['star', 'heart', 'rocket', 'bell'] as const;
export type Icon = (typeof icons)[number];

type State = {
  title: string;
  tooltip: string;
  icon: Icon;
  enabled: boolean;
  visible: boolean;
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
  clicks: 0,
  samples: 0,
};

// What the live Action shows. Its title, tooltip, icon, enabled and visible read this store;
// the control Actions only change it, and every place that shows the live Action follows.
export default defineService(({ store }) => {
  const state = store<State>(initial);
  return {
    state,
    set: (patch: Partial<Pick<State, 'title' | 'tooltip' | 'icon' | 'enabled' | 'visible'>>) =>
      state.set((current) => ({ ...current, ...patch })),
    click: () => state.set((current) => ({ ...current, clicks: current.clicks + 1 })),
    addSample: () =>
      state.set((current) => ({ ...current, samples: Math.min(current.samples + 1, 3) })),
    removeSample: () =>
      state.set((current) => ({ ...current, samples: Math.max(current.samples - 1, 0) })),
    reset: () => state.set(initial),
  };
});
