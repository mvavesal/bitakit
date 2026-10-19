import { z } from 'zod';

/** Serializable theme files; CSS variable names omit their leading double hyphen. */
export const themeTokensSchema = z.record(z.string(), z.string());
export const themeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  shared: themeTokensSchema.default({}),
  light: themeTokensSchema.default({}),
  dark: themeTokensSchema.default({}),
});
export type ShellThemeDefinition = z.output<typeof themeSchema>;
export type ShellThemeInput = z.input<typeof themeSchema>;
export type ThemeSource = 'shell' | 'app' | 'user';
export type ThemeEntry = ShellThemeDefinition & { source: ThemeSource; key: string };

/** Names are display text; identity includes the source so app themes remain additive. */
export function themeKey(source: ThemeSource, id: string): string {
  return `${source}:${id}`;
}

/** Reject duplicate identities rather than silently replacing a theme. */
export function themeCatalog(
  sources: Partial<Record<ThemeSource, readonly ShellThemeInput[]>>,
): ThemeEntry[] {
  const entries: ThemeEntry[] = [];
  const keys = new Set<string>();
  for (const source of ['shell', 'app', 'user'] as const) {
    for (const input of sources[source] ?? []) {
      const theme = themeSchema.parse(input);
      const key = themeKey(source, theme.id);
      if (keys.has(key)) throw new Error(`Duplicate theme identity: ${key}`);
      keys.add(key);
      entries.push({ ...theme, source, key });
    }
  }
  return entries;
}

/** Missing tokens inherit the central theme, including its existing control finish. */
export function themeTokens(
  theme: ShellThemeDefinition,
  mode: 'light' | 'dark',
): Record<string, string> {
  const tokens = { ...theme.shared, ...theme[mode] };
  // Tailwind composes surface shadows with border/focus rings in a shadow list.
  // CSS `none` is only valid on its own, so preserve rings with a transparent shadow.
  for (const name of [
    'theme-shadow-surface',
    'theme-shadow-overlay',
    'theme-shadow-field',
    'theme-shadow-control',
  ]) {
    if (tokens[name]?.trim() === 'none') tokens[name] = '0 0 #0000';
  }
  return tokens;
}

/** Selection and personal copies are saved atomically by the Core settings store. */
export const themeLibrarySchema = z.strictObject({
  selected: z.string().min(1),
  custom: z.array(themeSchema),
});
export type ThemeLibrary = z.output<typeof themeLibrarySchema>;
export const defaultTheme: ShellThemeDefinition = {
  schemaVersion: 1,
  id: 'default',
  name: 'BitaKit Default',
  shared: {},
  light: {},
  dark: {},
};
