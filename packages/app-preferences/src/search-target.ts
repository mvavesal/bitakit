import { defineContract, defineService } from '@bitakit/core';

export interface SettingsSearch {
  /** Whether a settings search is on screen. */
  shown(): boolean;
  /** The search on screen offers its focus; the returned call withdraws it. */
  show(focus: () => void): () => void;
  /** Focuses the search shown last. */
  focus(): void;
}
export const settingsSearch = defineContract('settings-search').of<SettingsSearch>();

/** Which settings search is on screen, so the search shortcut works only inside Settings. */
export const settingsSearchService = defineService(
  ({ store }) => {
    const targets: (() => void)[] = [];
    const state = store({ count: 0 });
    return {
      state,
      shown: () => state.get().count > 0,
      show(focus: () => void) {
        targets.push(focus);
        state.set({ count: targets.length });
        return () => {
          const index = targets.lastIndexOf(focus);
          if (index >= 0) targets.splice(index, 1);
          state.set({ count: targets.length });
        };
      },
      focus: () => targets.at(-1)?.(),
    };
  },
  { provides: settingsSearch },
);
