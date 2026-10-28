import { defineService } from '@bitakit/core';

export type Place = 'toolbar' | 'navigation';

export type Live = {
  /** Where the Action shows: the app bar, the sidebar, or both. */
  places: Place[];
  title: string;
  tooltip: string;
  icon: 'star' | 'heart' | 'rocket' | 'bell';
  enabled: boolean;
  visible: boolean;
  /** Ask before running. */
  confirm: boolean;
  /** Take a second, to show the pending state. */
  slow: boolean;
  /** The message after a run. */
  message: string;
};

export const initial: Live = {
  places: ['toolbar'],
  title: 'Live action',
  tooltip: '',
  icon: 'star',
  enabled: true,
  visible: true,
  confirm: false,
  slow: false,
  message: '',
};

// What the live Action shows. actions/live.ts reads it, actions/edit.ts changes it.
export default defineService(({ store }) => {
  const state = store<Live>(initial);
  return {
    state,
    set: (patch: Partial<Live>) => state.set((current) => ({ ...current, ...patch })),
  };
});
