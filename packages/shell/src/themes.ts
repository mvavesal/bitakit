import { z } from 'zod';
import { themeDefaults } from './theme-defaults.js';

/**
 * Serializable theme files; CSS variable names omit their leading double hyphen. `$schema` is
 * accepted so a downloaded file can be copied into `src/themes/` unchanged; the catalog drops it.
 */
export const themeTokensSchema = z.record(z.string(), z.string());
export const themeSchema = z.strictObject({
  $schema: z.string().optional(),
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
      const { $schema: _schema, ...theme } = themeSchema.parse(input);
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

/** Where the published JSON Schema of theme files lives; downloaded files reference it. */
export const themeFileSchemaUrl = 'https://unpkg.com/@bitakit/shell/dist/theme.schema.json';

/** Every variable of the central theme contract; imported files may set only these. */
const themeTokenNames = [
  ...new Set([...Object.keys(themeDefaults.light), ...Object.keys(themeDefaults.dark)]),
].sort() as [string, ...string[]];
const caseless = (word: string) => word.replace(/[a-z]/g, (c) => `[${c}${c.toUpperCase()}]`);
const resourceFunctions = ['url', 'image', 'image-set', 'src', 'element', 'cross-fade']
  .map(caseless)
  .join('|');
/**
 * Imported values are applied to `<html>`, so they may not load resources (`url(` and the other
 * image functions, in any case) or hide them behind CSS escapes. Written without regex flags so
 * the JSON Schema enforces the same rule.
 */
const fileTokenValue = z
  .string()
  .regex(
    new RegExp(`^(?![\\s\\S]*(?:${resourceFunctions})\\s*\\()[^;{}<>\\\\@]*$`),
    'Theme values may not load resources (url(), image functions) or contain ; { } < > \\ or @.',
  );
const fileTokens = z.partialRecord(z.enum(themeTokenNames), fileTokenValue);

/**
 * A theme file from a download, another app or an agent: the theme definition with an optional
 * `$schema`, limited to known tokens and safe values. Bundled and app themes are trusted and use
 * `themeSchema`.
 */
export const themeFileSchema = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  shared: fileTokens.default({}),
  light: fileTokens.default({}),
  dark: fileTokens.default({}),
});

/** Parses theme file text. Throws an Error naming the first problem and its location. */
export function parseThemeFile(text: string): ShellThemeDefinition {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('The theme file is not valid JSON.');
  }
  const result = themeFileSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    const path = issue.path.map(String).join('.');
    throw new Error(
      path
        ? `Invalid theme file at "${path}": ${issue.message}`
        : `Invalid theme file: ${issue.message}`,
    );
  }
  const { $schema: _schema, ...theme } = result.data;
  return theme as ShellThemeDefinition;
}

/** The downloadable file of a theme: its definition and `$schema`, without source or key. */
export function stringifyThemeFile(theme: ShellThemeDefinition): string {
  const { schemaVersion, id, name, shared, light, dark } = theme;
  const file = { $schema: themeFileSchemaUrl, schemaVersion, id, name, shared, light, dark };
  return `${JSON.stringify(file, null, 2)}\n`;
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
  name: 'App default',
  shared: {},
  light: {},
  dark: {},
};
