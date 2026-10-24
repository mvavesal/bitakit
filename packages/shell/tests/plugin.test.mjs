import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, settle, catalogTranslator } from './support.mjs';
import { createElement as h } from 'react';
import { BitaKitRuntime, createActionList, createMemorySettingsStorage } from '@bitakit/core';
import { BitaKitRuntimeProvider, useSettingsCatalog } from '@bitakit/ui';
import { shellPlugin, shellOptions } from '../dist/index.js';
import foundationEntry from '../dist/foundation.js';
import en from '../locales/en.json' with { type: 'json' };
import de from '../locales/de.json' with { type: 'json' };
import manifest from '../package.json' with { type: 'json' };

test('the factory validates its options and names the invalid key', () => {
  assert.equal(foundationEntry, shellPlugin, 'the discovery entry exports the factory');
  assert.deepEqual(shellPlugin().config, { navigationSlot: 'shell.navigation' });
  assert.equal(shellPlugin({ navigationSlot: 'custom.nav' }).config.navigationSlot, 'custom.nav');
  // Discovery passes the frozen config subtree of configs/shell.ts.
  assert.doesNotThrow(() => shellPlugin(Object.freeze({ navigationSlot: 'shell.navigation' })));
  assert.throws(
    () => shellPlugin({ appearance: true, notifications: true }),
    /^Error: Unknown Shell option "appearance", "notifications"\. Supported options: navigationSlot, presets, themes\.$/,
  );
  assert.throws(() => shellPlugin({ navigationSlot: [] }), /Invalid Shell option "navigationSlot"/);
  assert.throws(
    () => shellPlugin({ presets: [{ id: 'ocean', color: 'blue' }] }),
    /Unknown Shell option "presets\.0\.color"\.$/,
  );
  assert.throws(
    () => shellPlugin({ presets: [{ id: 7 }] }),
    /Invalid Shell option "presets\.0\.id"/,
  );
  assert.throws(() => shellPlugin('sidebar'), /Invalid Shell options/);
  assert.equal(
    shellOptions.safeParse({ navigationSlot: 'shell.navigation', presets: [{ id: 'ocean' }] })
      .success,
    true,
  );
});

test('appearance settings: keys, scopes and defaults; preset only with presets', () => {
  const { settings, section } = shellPlugin().settings;
  const summary = (specs) =>
    Object.fromEntries(
      Object.entries(specs).map(([name, spec]) => [
        name,
        [spec.scope, spec.default, spec.control, spec.options.map((option) => option.value)],
      ]),
    );
  assert.deepEqual(
    summary(Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'themeLibrary'))),
    {
      mode: ['device', 'system', 'cards', ['light', 'dark', 'system']],
      layout: ['user', 'sidebar', 'cards', ['sidebar', 'navbar']],
      density: ['user', 'comfortable', 'cards', ['comfortable', 'compact']],
      corners: ['user', 'default', 'radio', ['default', 'round', 'square']],
      toasts: [
        'device',
        'bottom',
        'select',
        ['top start', 'top', 'top end', 'bottom start', 'bottom', 'bottom end'],
      ],
    },
  );
  for (const name of ['mode', 'layout'])
    assert.ok(
      settings[name].options.every((option) => option.icon),
      `${name} options carry icons for the cards`,
    );
  assert.equal(section.title, 'Themes');
  assert.equal(section.category, 'appearance');
  assert.equal(section.order, -5);

  const themed = shellPlugin({ presets: [{ id: 'ocean', label: 'Ocean' }, { id: 'forest' }] })
    .settings.settings;
  assert.deepEqual(Object.keys(themed), [
    'themeLibrary',
    'mode',
    'layout',
    'preset',
    'density',
    'corners',
    'toasts',
  ]);
  assert.deepEqual(
    themed.preset.options.map((option) => [option.value, option.label]),
    [
      ['default', 'Default'],
      ['ocean', 'Ocean'],
      ['forest', undefined],
    ],
  );
  assert.equal(themed.preset.default, 'default');
  assert.equal(themed.preset.scope, 'user');

  const runtime = new BitaKitRuntime(createActionList(), { plugins: [shellPlugin()] });
  assert.deepEqual(
    runtime.settings.entries().map((entry) => entry.key),
    [
      'shell.themeLibrary',
      'shell.mode',
      'shell.layout',
      'shell.density',
      'shell.corners',
      'shell.toasts',
    ],
  );
  assert.equal(runtime.settings.has('shell.preset'), false);
  assert.throws(
    () => runtime.settings.parse('shell.layout', 'stacked'),
    /accepts "sidebar", "navbar"/,
  );
});

test('the settings catalog labels the Themes and Layout pages from the Shell locales', async () => {
  const config = { plugins: [shellPlugin({ presets: [{ id: 'ocean', label: 'Ocean' }] })] };
  const services = { 'settings.storage': createMemorySettingsStorage() };
  let sections;
  function Catalog() {
    sections = useSettingsCatalog();
    return null;
  }
  const render = (messages) =>
    h(
      BitaKitRuntimeProvider,
      { config, services, translate: catalogTranslator(messages) },
      h(Catalog),
    );
  const view = await mount(render(en));
  try {
    await settle();
    const shell = () => sections.find((section) => section.id === 'shell');
    const labels = () => ({
      title: shell().title,
      description: shell().description,
      fields: shell().fields.map((field) => [
        field.key,
        field.label,
        field.options.map((option) => option.label),
      ]),
    });
    assert.deepEqual(
      sections
        .filter((section) => section.category === 'appearance')
        .map(({ id, title, path }) => ({ id, title, path })),
      [
        { id: 'shell', title: 'Themes', path: 'shell' },
        { id: 'shell/layout', title: 'Layout', path: 'shell/layout' },
      ],
    );
    assert.equal(
      sections.find((section) => section.id === 'shell/layout').description,
      'Navigation, spacing and notification position.',
    );
    assert.equal(shell().category, 'appearance');
    assert.equal(shell().order, -5);
    assert.ok(shell().icon, 'the section has an icon');
    assert.deepEqual(labels(), {
      title: 'Themes',
      description: 'Color scheme and themes for your interface.',
      fields: [
        ['shell.mode', 'Color scheme', ['Light', 'Dark', 'System']],
        ['shell.layout', 'Navigation', ['Sidebar', 'Navigation bar']],
        ['shell.preset', 'Theme', ['Default', 'Ocean']],
        ['shell.density', 'Density', ['Comfortable', 'Compact']],
        ['shell.corners', 'Corners', ['Default', 'Round', 'Square']],
        [
          'shell.toasts',
          'Notification position',
          ['Top start', 'Top center', 'Top end', 'Bottom start', 'Bottom center', 'Bottom end'],
        ],
      ],
    });
    assert.equal(
      shell().fields[0].description,
      'Light, dark or matching your system. Applies to this device.',
    );
    await view.render(render(de));
    await settle();
    assert.equal(labels().title, 'Themes');
    assert.equal(
      sections.find((section) => section.id === 'shell/layout').description,
      'Navigation, Abstände und Position der Benachrichtigungen.',
    );
    assert.deepEqual(labels().fields[0], [
      'shell.mode',
      'Farbschema',
      ['Hell', 'Dunkel', 'System'],
    ]);
    assert.deepEqual(labels().fields[2], ['shell.preset', 'Theme', ['Standard', 'Ocean']]);
  } finally {
    await view.unmount();
  }
});

test('locales share one key set under the shell namespace; the manifest declares the slots', () => {
  const keys = (node, prefix = '') =>
    Object.entries(node).flatMap(([key, value]) =>
      typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  assert.deepEqual(keys(de), keys(en));
  assert.deepEqual(Object.keys(en), ['shell']);
  assert.deepEqual(Object.keys(en.shell), ['settings', 'ui', 'pages']);
  assert.deepEqual(manifest.bitakit, {
    plugin: './foundation',
    configuration: 'shell',
    styles: './styles.css',
    slots: ['app-bar.end', 'sidebar.header', 'sidebar.footer'],
  });
  assert.equal(manifest.foundation, undefined);
  assert.deepEqual(Object.keys(manifest.exports), [
    '.',
    './foundation',
    './pages',
    './theme.schema.json',
    './styles.css',
    './locales/*.json',
    './package.json',
  ]);
  assert.equal(manifest.dependencies['@bitakit/app-preferences'], undefined);
});
