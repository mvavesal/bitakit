import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SettingsRendererRegistry,
  SettingsConfigurationError,
  builtInRenderers,
  defineSettings,
  defineSettingsRenderers,
  fieldRenderer,
  typeRenderer,
  sectionRenderer,
  viewRenderer,
  choiceField,
  booleanField,
} from '../dist/index.js';

const named = (name) => Object.defineProperty(() => null, 'name', { value: name });
const shell = defineSettings({
  id: 'shell',
  fields: {
    theme: choiceField({ options: ['light', 'dark'], defaultValue: 'light' }),
    layout: choiceField({
      options: ['sidebar', 'navbar'],
      defaultValue: 'sidebar',
      presentation: { variant: 'cards' },
    }),
    compact: booleanField({ defaultValue: false }),
  },
});
const other = defineSettings({
  id: 'other',
  fields: { mode: choiceField({ options: ['a', 'b'], defaultValue: 'a' }) },
});
const app = { layer: 'app', owner: 'content', origin: 'renderers/app.tsx (content)' };
const plugin = { layer: 'plugin', owner: 'shell', origin: 'renderers/shell.tsx (shell)' };
const owners = { shell: ['shell'], other: ['other'] };
const resolve = (registry, setting) =>
  registry.getSnapshot().resolveField(setting, owners[setting.collection]).component.name;

test('field-first precedence with explicit variants follows the documented order', () => {
  const registry = new SettingsRendererRegistry(builtInRenderers);
  const { theme, layout } = shell.fields;
  assert.equal(resolve(registry, theme), 'SelectControl', '8. built-in type default');
  assert.equal(resolve(registry, layout), 'CardsControl', '5. built-in requested variant');
  const pluginGeneric = registry.register(typeRenderer('choice', named('PluginChoice')), plugin);
  assert.equal(resolve(registry, theme), 'PluginChoice', '7. owner plugin generic type');
  assert.equal(
    resolve(registry, layout),
    'CardsControl',
    'a generic override never erases a variant request',
  );
  const appGeneric = registry.register(typeRenderer('choice', named('AppChoice')), app);
  assert.equal(resolve(registry, theme), 'AppChoice', '6. app generic type');
  const pluginCards = registry.register(
    typeRenderer('choice', named('PluginCards'), { variant: 'cards' }),
    plugin,
  );
  assert.equal(resolve(registry, layout), 'PluginCards', '4. owner plugin type + variant');
  const appCards = registry.register(
    typeRenderer('choice', named('AppCards'), { variant: 'cards' }),
    app,
  );
  assert.equal(resolve(registry, layout), 'AppCards', '3. app type + variant');
  const pluginField = registry.register(fieldRenderer(layout, named('ShellLayout')), plugin);
  assert.equal(resolve(registry, layout), 'ShellLayout', '2. owner plugin field renderer');
  const appField = registry.register(fieldRenderer(layout, named('AppLayout')), app);
  assert.equal(resolve(registry, layout), 'AppLayout', '1. app field override');
  appField.remove();
  assert.equal(resolve(registry, layout), 'ShellLayout', 'removal restores the next fallback');
  pluginField.remove();
  appCards.remove();
  pluginCards.remove();
  appGeneric.remove();
  pluginGeneric.remove();
  assert.equal(resolve(registry, layout), 'CardsControl');
  assert.equal(resolve(registry, theme), 'SelectControl');
});

test('plugin type renderers only restyle their own fields; app overrides are global', () => {
  const registry = new SettingsRendererRegistry(builtInRenderers);
  registry.register(typeRenderer('choice', named('ShellChoice')), plugin);
  assert.equal(resolve(registry, shell.fields.theme), 'ShellChoice');
  assert.equal(resolve(registry, other.fields.mode), 'SelectControl');
  registry.register(typeRenderer('choice', named('AppChoice')), app);
  assert.equal(resolve(registry, other.fields.mode), 'AppChoice');
});

test('unknown variants are configuration errors, not silent fallbacks', () => {
  const registry = new SettingsRendererRegistry(builtInRenderers);
  const custom = defineSettings({
    id: 'custom',
    fields: {
      color: choiceField({
        options: ['red'],
        defaultValue: 'red',
        presentation: { variant: 'swatches' },
      }),
    },
  });
  assert.throws(
    () => registry.getSnapshot().resolveField(custom.fields.color, ['custom']),
    (error) =>
      error instanceof SettingsConfigurationError &&
      /Unknown variant "swatches" for choice setting "custom.color"/.test(error.message),
  );
  registry.register(typeRenderer('choice', named('Swatches'), { variant: 'swatches' }), plugin);
  assert.throws(
    () => registry.getSnapshot().resolveField(custom.fields.color, ['custom']),
    /Unknown variant "swatches"/,
    "another plugin's variant does not apply",
  );
});

test('plugins cannot target foreign fields, sections or views; duplicates name both sources', () => {
  const registry = new SettingsRendererRegistry(builtInRenderers);
  registry.register(fieldRenderer(other.fields.mode, named('Hijack')), plugin);
  assert.throws(
    () => registry.getSnapshot().resolveField(other.fields.mode, ['other']),
    /renderers\/shell.tsx \(shell\) targets field "other.mode", which "shell" does not own/,
  );
  assert.throws(
    () => registry.register(viewRenderer('settings', named('View')), plugin),
    /Only the application may replace the settings settings view/,
  );
  registry.register(typeRenderer('boolean', named('One')), app);
  assert.throws(
    () =>
      registry.register(typeRenderer('boolean', named('Two')), {
        ...app,
        origin: 'renderers/second.tsx (content)',
      }),
    /Duplicate settings renderer for type "boolean": renderers\/app.tsx \(content\) and renderers\/second.tsx \(content\)/,
  );
  registry.register(typeRenderer('text', named('ShellText')), plugin);
  registry.register(typeRenderer('text', named('OtherText')), {
    layer: 'plugin',
    owner: 'other',
    origin: 'other',
  });
  const atomic = new SettingsRendererRegistry(builtInRenderers);
  assert.throws(() =>
    atomic.registerSet(
      defineSettingsRenderers({
        types: [typeRenderer('number', named('A')), typeRenderer('number', named('B'))],
      }),
      app,
    ),
  );
  assert.equal(
    atomic.getSnapshot().resolveField(shell.fields.compact, ['shell']).component.name,
    'CheckboxControl',
  );
  assert.equal(atomic.getSnapshot().version, 0, 'a failed set registers nothing');
  const sections = new SettingsRendererRegistry(builtInRenderers);
  sections.register(sectionRenderer('appearance', named('ShellAppearance')), plugin);
  assert.equal(
    sections.getSnapshot().resolveSection({ id: 'appearance', pluginId: 'shell' }).name,
    'ShellAppearance',
  );
  assert.throws(
    () => sections.getSnapshot().resolveSection({ id: 'appearance', pluginId: 'content' }),
    /targets section "appearance", which "shell" does not own/,
  );
  sections.register(sectionRenderer('appearance', named('AppAppearance')), app);
  assert.throws(() =>
    sections.getSnapshot().resolveSection({ id: 'appearance', pluginId: 'content' }),
  );
});

test('descriptors are validated with the source and snapshots change identity only on change', () => {
  assert.throws(() => typeRenderer('color', named('X')), /Unknown setting type "color"/);
  assert.throws(() => typeRenderer('choice', 'not a component'), /needs a React component/);
  assert.throws(
    () => typeRenderer('choice', named('X'), { variant: 'Bad Variant' }),
    /Invalid variant/,
  );
  const registry = new SettingsRendererRegistry(builtInRenderers);
  const snapshot = registry.getSnapshot();
  assert.equal(registry.getSnapshot(), snapshot);
  let notified = 0;
  registry.subscribe(() => notified++);
  const registration = registry.register(typeRenderer('text', named('Text')), app);
  assert.notEqual(registry.getSnapshot(), snapshot);
  registration.remove();
  registration.remove();
  assert.equal(notified, 2);
});
