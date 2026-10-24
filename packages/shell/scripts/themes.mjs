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
// Editor defaults come from the same CSS contract, not a second hand-maintained palette.
const { default: postcss } = await import('postcss');
const css = postcss.parse(await readFile(new URL('../../ui/theme.css', import.meta.url), 'utf8'));
const defaults = { light: {}, dark: {} };
const primitiveFolder = new URL('../../ui/src/components/primitives/', import.meta.url);
const primitiveNames = (await readdir(primitiveFolder)).filter((name) => name.endsWith('.tsx'));
const primitiveSources = await Promise.all(
  primitiveNames.map((name) => readFile(new URL(name, primitiveFolder), 'utf8')),
);
// Optional token overrides must not leak from the active theme into another theme's preview.
for (const match of [css.toString(), ...primitiveSources]
  .join('\n')
  .matchAll(/var\(\s*(--theme-[\w-]+)/g)) {
  defaults.light[match[1].slice(2)] = 'initial';
}
css.walkAtRules('theme', (rule) => {
  if (rule.params.includes('inline')) return;
  rule.walkDecls((declaration) => {
    if (declaration.prop.startsWith('--'))
      defaults.light[declaration.prop.slice(2)] = declaration.value;
  });
});
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

// The explicit BitaKit choice owns its palette; the legacy default keeps inheriting app CSS.
themes.push({
  schemaVersion: 1,
  id: 'bitakit',
  name: 'BitaKit Default',
  shared: {},
  light: defaults.light,
  dark: defaults.dark,
});
await writeFile(
  new URL('../src/bundled-themes.ts', import.meta.url),
  `// Generated from themes/*.json and the central theme CSS by the Shell build.\nimport type { ShellThemeInput } from './themes.js';\nexport const bundledThemes: readonly ShellThemeInput[] = ${JSON.stringify(themes, null, 2)};\n`,
);
