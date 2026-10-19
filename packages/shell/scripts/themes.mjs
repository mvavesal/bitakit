import { readdir, readFile, writeFile } from 'node:fs/promises';
const folder = new URL('../themes/', import.meta.url);
const names = (await readdir(folder)).filter((name) => name.endsWith('.json')).sort();
const themes = await Promise.all(
  names.map(async (name) => {
    try {
      return JSON.parse(await readFile(new URL(name, folder), 'utf8'));
    } catch (error) {
      throw new Error(`Invalid Shell theme ${name}: ${error.message}`);
    }
  }),
);
await writeFile(
  new URL('../src/bundled-themes.ts', import.meta.url),
  `// Generated from themes/*.json by the Shell build.\nimport type { ShellThemeInput } from './themes.js';\nexport const bundledThemes = ${JSON.stringify(themes, null, 2)} satisfies ShellThemeInput[];\n`,
);

// Editor defaults come from the same CSS contract, not a second hand-maintained palette.
const { default: postcss } = await import('postcss');
const css = postcss.parse(await readFile(new URL('../../ui/theme.css', import.meta.url), 'utf8'));
const defaults = { light: {}, dark: {} };
css.walkRules((rule) => {
  if (rule.selector !== ':root' && rule.selector !== '.dark') return;
  const target = rule.selector === ':root' ? defaults.light : defaults.dark;
  rule.walkDecls((declaration) => {
    if (declaration.prop.startsWith('--')) target[declaration.prop.slice(2)] = declaration.value;
  });
});
await writeFile(
  new URL('../src/theme-defaults.ts', import.meta.url),
  `// Generated from the central theme CSS by the Shell build.\nexport const themeDefaults: Record<'light' | 'dark', Record<string, string>> = ${JSON.stringify(defaults, null, 2)};\n`,
);
