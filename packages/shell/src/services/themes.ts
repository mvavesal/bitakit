import { defineContract, type SettingHandle, type SaveResult } from '@bitakit/core';
import {
  defaultTheme,
  themeCatalog,
  themeKey,
  themeSchema,
  type ShellThemeInput,
  type ThemeEntry,
  type ThemeLibrary,
} from '../themes.js';

export interface ThemeService {
  list(): readonly ThemeEntry[];
  active(): ThemeEntry;
  canWrite(): boolean;
  select(key: string): Promise<SaveResult>;
  remove(id: string): Promise<SaveResult>;
  update(theme: ShellThemeInput): Promise<SaveResult>;
  saveCopy(theme: ShellThemeInput): Promise<SaveResult>;
  subscribe(listener: () => void): () => void;
}
export const themeService = defineContract('themes').of<ThemeService>();

/** Core owns confirmed values, persistence, pending state and identity transitions. */
export function createThemeService(
  library: SettingHandle<ThemeLibrary>,
  bundled: readonly ShellThemeInput[] = [defaultTheme],
  additional: readonly ShellThemeInput[] = [],
): ThemeService {
  themeCatalog({ shell: bundled, app: additional });
  const list = () => themeCatalog({ shell: bundled, app: additional, user: library.get().custom });
  const canWrite = () => {
    const state = library.state();
    return state.ready && state.writable && !state.pending;
  };
  const requireWritable = () => {
    if (!canWrite()) throw new Error('Theme settings are not ready for a write.');
  };
  return {
    list,
    active: () => {
      const entries = list();
      return (
        entries.find((entry) => entry.key === library.get().selected) ??
        entries.find((entry) => entry.key === 'shell:default')!
      );
    },
    canWrite,
    select(key) {
      requireWritable();
      if (!list().some((entry) => entry.key === key)) throw new Error(`Unknown theme: ${key}`);
      return library.set({ ...library.get(), selected: key });
    },
    remove(id) {
      requireWritable();
      const current = library.get();
      if (!current.custom.some((entry) => entry.id === id))
        throw new Error('Only personal themes can be deleted.');
      return library.set({
        selected: current.selected === themeKey('user', id) ? 'shell:default' : current.selected,
        custom: current.custom.filter((entry) => entry.id !== id),
      });
    },
    update(input) {
      requireWritable();
      const theme = themeSchema.parse(input);
      const current = library.get();
      if (!current.custom.some((entry) => entry.id === theme.id))
        throw new Error('Only personal themes can be updated.');
      return library.set({
        ...current,
        custom: current.custom.map((entry) => (entry.id === theme.id ? theme : entry)),
      });
    },
    saveCopy(input) {
      requireWritable();
      const theme = themeSchema.parse(input);
      const key = themeKey('user', theme.id);
      if (list().some((entry) => entry.key === key))
        throw new Error(`Duplicate theme identity: ${key}`);
      return library.set({ selected: key, custom: [...library.get().custom, theme] });
    },
    subscribe: (listener) => library.subscribe(listener),
  };
}
