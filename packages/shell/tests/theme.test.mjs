import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, settle, setMedia, deferred } from './support.mjs';
import { createElement as h, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemorySettingsStorage } from '@bitakit/core';
import { BitaKitRuntimeProvider, useBitaKit } from '@bitakit/ui';
import { shellPlugin, ShellThemeScript } from '../dist/index.js';

const root = document.documentElement;
const snapshot = () => ({
  dark: root.classList.contains('dark'),
  colorScheme: root.style.colorScheme,
  density: root.getAttribute('data-density'),
  corners: root.getAttribute('data-shell-corners'),
  preset: root.getAttribute('data-theme-preset'),
});
function resetRoot() {
  root.removeAttribute('class');
  root.removeAttribute('style');
  for (const name of ['data-density', 'data-shell-corners', 'data-theme-preset'])
    root.removeAttribute(name);
}

async function mountShell(plugin, services) {
  let runtime;
  function Probe() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const view = await mount(
    h(BitaKitRuntimeProvider, { config: { plugins: [plugin] }, services }, h(Probe)),
  );
  return { view, runtime: () => runtime };
}

test('the theme provider projects confirmed settings onto <html> and restores the host values', async () => {
  resetRoot();
  // The state the pre-paint script and the host left before hydration.
  root.classList.add('dark');
  root.style.colorScheme = 'dark';
  root.setAttribute('data-density', 'host');
  const gate = deferred();
  const memory = createMemorySettingsStorage({
    'shell.mode': 'light',
    'shell.density': 'compact',
    'shell.corners': 'square',
    'shell.preset': 'ocean',
  });
  const storage = {
    load: async (key, context) => {
      await gate.promise;
      return memory.load(key, context);
    },
    save: (key, value, context) => memory.save(key, value, context),
  };
  const { view, runtime } = await mountShell(shellPlugin({ presets: [{ id: 'ocean' }] }), {
    'settings.storage': storage,
  });
  try {
    await settle();
    assert.deepEqual(
      snapshot(),
      { dark: true, colorScheme: 'dark', density: 'host', corners: null, preset: null },
      'values that are not loaded leave the document unchanged',
    );
    gate.resolve();
    await settle();
    assert.deepEqual(snapshot(), {
      dark: false,
      colorScheme: 'light',
      density: 'compact',
      corners: 'square',
      preset: 'ocean',
    });

    await act(() => runtime().settings.set('shell.mode', 'system'));
    assert.equal(snapshot().dark, false, 'system follows a light preference');
    await setMedia({ dark: true });
    assert.deepEqual([snapshot().dark, snapshot().colorScheme], [true, 'dark']);
    await setMedia({ dark: false });
    assert.deepEqual([snapshot().dark, snapshot().colorScheme], [false, 'light']);
    await act(() => runtime().settings.set('shell.mode', 'dark'));
    assert.deepEqual([snapshot().dark, snapshot().colorScheme], [true, 'dark']);
    await act(() => runtime().settings.set('shell.density', 'comfortable'));
    await act(() => runtime().settings.set('shell.corners', 'round'));
    await act(() => runtime().settings.set('shell.preset', 'default'));
    assert.deepEqual(
      [snapshot().density, snapshot().corners, snapshot().preset],
      ['comfortable', 'round', 'default'],
    );
    await act(() => runtime().settings.set('shell.mode', 'light'));
  } finally {
    await view.unmount();
  }
  assert.deepEqual(
    snapshot(),
    { dark: true, colorScheme: 'dark', density: 'host', corners: null, preset: null },
    'unmounting restores what the host had',
  );
  resetRoot();
});

test('without presets the provider leaves data-theme-preset alone; defaults apply once loaded', async () => {
  resetRoot();
  const { view } = await mountShell(shellPlugin(), {
    'settings.storage': createMemorySettingsStorage(),
  });
  try {
    await settle();
    assert.deepEqual(snapshot(), {
      dark: false,
      colorScheme: 'light',
      density: 'comfortable',
      corners: 'default',
      preset: null,
    });
  } finally {
    await view.unmount();
  }
  assert.deepEqual(snapshot(), {
    dark: false,
    colorScheme: '',
    density: null,
    corners: null,
    preset: null,
  });
});

test('the pre-paint script reads the value the runtime stores in browser storage', async () => {
  resetRoot();
  localStorage.clear();
  // Default storage: no settings.storage service, so the runtime writes to localStorage.
  const { view, runtime } = await mountShell(shellPlugin());
  try {
    await settle();
    await act(() => runtime().settings.set('shell.mode', 'dark'));
  } finally {
    await view.unmount();
  }
  assert.equal(localStorage.getItem('bitakit.settings.device/shell.mode'), '"dark"');
  const markup = renderToStaticMarkup(h(ShellThemeScript, { nonce: 'n0nce' }));
  assert.match(markup, /^<script nonce="n0nce">/);
  const code = /<script[^>]*>([\s\S]*)<\/script>/.exec(markup)[1];
  const run = () => new Function(code)();

  resetRoot();
  run();
  assert.deepEqual([snapshot().dark, snapshot().colorScheme], [true, 'dark']);
  localStorage.setItem('bitakit.settings.device/shell.mode', '"light"');
  run();
  assert.deepEqual([snapshot().dark, snapshot().colorScheme], [false, 'light']);
  localStorage.setItem('bitakit.settings.device/shell.mode', '"system"');
  await setMedia({ dark: true });
  run();
  assert.equal(snapshot().dark, true, 'system follows the color-scheme preference');
  localStorage.removeItem('bitakit.settings.device/shell.mode');
  run();
  assert.equal(snapshot().dark, true, 'no stored value means system');
  localStorage.setItem('bitakit.settings.device/shell.mode', '{broken');
  await setMedia({ dark: false });
  run();
  assert.deepEqual([snapshot().dark, snapshot().colorScheme], [false, 'light']);
  localStorage.clear();
  resetRoot();
});

test('JSON themes follow color scheme and remove overrides when returning to default', async () => {
  resetRoot();
  root.style.setProperty('--radius', '2rem');
  const { view, runtime } = await mountShell(
    shellPlugin({
      themes: [
        {
          schemaVersion: 1,
          id: 'ocean',
          name: 'Ocean',
          shared: { radius: '1rem' },
          light: { primary: 'blue' },
          dark: { primary: 'cyan' },
        },
      ],
    }),
    { 'settings.storage': createMemorySettingsStorage() },
  );
  try {
    await settle();
    assert.equal(root.style.getPropertyValue('--radius'), '2rem');
    await act(() => runtime().services.themes.select('app:ocean'));
    await act(() => runtime().settings.set('shell.mode', 'light'));
    assert.equal(root.style.getPropertyValue('--radius'), '1rem');
    assert.equal(root.style.getPropertyValue('--primary'), 'blue');
    await act(() => runtime().settings.set('shell.mode', 'dark'));
    assert.equal(root.style.getPropertyValue('--primary'), 'cyan');
    await act(() => runtime().services.themes.select('shell:default'));
    assert.equal(root.style.getPropertyValue('--radius'), '2rem');
    assert.equal(root.style.getPropertyValue('--primary'), '');
    await act(() => runtime().services.themes.select('app:ocean'));
  } finally {
    await view.unmount();
  }
  assert.equal(root.style.getPropertyValue('--radius'), '2rem');
  assert.equal(root.style.getPropertyValue('--primary'), '');
  resetRoot();
});
