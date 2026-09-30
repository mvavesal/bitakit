import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { z } from 'zod';

// React DOM detects DOM features when it loads, so the globals must exist before it is imported.
const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const key of [
  'HTMLElement',
  'HTMLInputElement',
  'HTMLFormElement',
  'Element',
  'Node',
  'MutationObserver',
  'DocumentFragment',
  'CustomEvent',
  'Event',
])
  globalThis[key] = dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, act } = await import('react');
const { createRoot, hydrateRoot } = await import('react-dom/client');
const { renderToString } = await import('react-dom/server');
const {
  createAppPreferences,
  createMemoryStorage,
  createSettingsRenderers,
  defineSettings,
  defineSettingsSection,
  booleanField,
  choiceField,
  numberField,
  textField,
  fieldRenderer,
  sectionRenderer,
  SettingsProvider,
  SettingsUIProvider,
  SettingsView,
  SettingsSectionView,
  SettingsField,
} = await import('../dist/index.js');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const preferences = () =>
  defineSettings({
    id: 'editor',
    fields: {
      density: choiceField({
        title: 'Density',
        description: 'Spacing of lists.',
        options: [
          { value: 'comfortable', label: 'Comfortable', description: 'More space' },
          { value: 'compact', label: 'Compact' },
        ],
        defaultValue: 'comfortable',
        presentation: { variant: 'cards', order: 1 },
      }),
      autosave: booleanField({ defaultValue: true, presentation: { variant: 'switch', order: 2 } }),
      signature: textField({ defaultValue: '', schema: z.string().max(5, 'Keep it short.') }),
      pageSize: numberField({ defaultValue: 20 }),
    },
  });
async function mount(element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return {
    host,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve)));

test('default views render sections without UI code and keep label, description and error associations', async () => {
  const editor = preferences();
  const gate = { current: null };
  const settings = createAppPreferences({
    storage: {
      ...createMemoryStorage(),
      async load() {
        return { writable: true };
      },
      async save(_key, value) {
        gate.current = deferred();
        await gate.current.promise;
        if (value === 'fail') throw new Error('offline');
      },
    },
  });
  settings.register(editor, { owner: 'editor' });
  settings.add(defineSettingsSection({ id: 'editor', title: 'Editor', settings: [editor] }));
  settings.add(defineSettingsSection({ id: 'empty', title: 'Empty', settings: [] }));
  const view = await mount(h(SettingsProvider, { settings }, h(SettingsView)));
  try {
    const { host } = view;
    assert.deepEqual(
      [...host.querySelectorAll('nav button')].map((button) => button.textContent),
      ['Editor'],
      'empty sections are not listed',
    );
    assert.equal(host.querySelector('h2').textContent, 'Editor');
    const group = host.querySelector('[role=radiogroup]');
    const label = document.getElementById(group.getAttribute('aria-labelledby'));
    assert.equal(label.textContent, 'Density');
    const describedBy = group.getAttribute('aria-describedby').split(' ');
    assert.equal(document.getElementById(describedBy[0]).textContent, 'Spacing of lists.');
    assert.ok(document.getElementById(describedBy[1]), 'feedback slot is referenced');
    const toggle = host.querySelector('[role=switch]');
    assert.equal(document.querySelector(`label[for="${toggle.id}"]`).textContent, 'Autosave');
    const compact = host.querySelector('[role=radio][value=compact]');
    await act(async () => compact.click());
    assert.equal(
      compact.getAttribute('aria-checked'),
      'true',
      'the draft shows the requested value while pending',
    );
    assert.equal(compact.disabled, false, 'pending writes do not disable controls');
    assert.equal(settings.get(editor.fields.density).value, 'comfortable');
    assert.match(host.textContent, /Saving…/);
    await act(async () => gate.current.resolve());
    assert.equal(settings.get(editor.fields.density).value, 'compact');
  } finally {
    await view.unmount();
  }
});

test('failed writes revert to the confirmed value and show an alert; validation issues are shown as written', async () => {
  const editor = preferences();
  let fail = true;
  const settings = createAppPreferences({
    storage: {
      async load() {
        return { writable: true };
      },
      async save() {
        if (fail) throw new Error('offline');
      },
    },
  });
  settings.register(editor, { owner: 'editor' });
  const section = defineSettingsSection({ id: 'editor', title: 'Editor', settings: [editor] });
  const view = await mount(
    h(
      SettingsProvider,
      { settings },
      h(
        SettingsUIProvider,
        { messages: { saveFailed: 'Could not save.' } },
        h(SettingsSectionView, { section }),
      ),
    ),
  );
  try {
    const { host } = view;
    await settle();
    const compact = host.querySelector('[role=radio][value=compact]');
    await act(async () => compact.click());
    await settle();
    assert.equal(
      host.querySelector('[role=radio][value=comfortable]').getAttribute('aria-checked'),
      'true',
    );
    assert.equal(host.querySelector('[role=alert]').textContent, 'Could not save.');
    fail = false;
    const text = [...host.querySelectorAll('input[type=text]')][0];
    await act(async () => {
      text.focus();
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      ).set;
      setter.call(text, 'too long');
      text.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await act(async () =>
      text.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    );
    await settle();
    assert.ok(
      [...host.querySelectorAll('[role=alert]')].some(
        (node) => node.textContent === 'Keep it short.',
      ),
    );
    assert.equal(text.getAttribute('aria-invalid'), 'true');
    assert.equal(text.value, 'too long', 'the draft is kept for correction');
    await act(async () =>
      text.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    assert.equal(text.value, '', 'Escape restores the confirmed value');
  } finally {
    await view.unmount();
  }
});

test('custom field and section renderers get typed, pre-bound state without owning persistence', async () => {
  const editor = preferences();
  const storage = createMemoryStorage();
  const settings = createAppPreferences({ storage });
  settings.register(editor, { owner: 'editor' });
  const renderers = createSettingsRenderers({
    fields: [
      fieldRenderer(editor.fields.pageSize, ({ value, setValue, id, describedBy, disabled }) =>
        h(
          'button',
          { id, 'aria-describedby': describedBy, disabled, onClick: () => setValue(value + 5) },
          `Rows: ${value}`,
        ),
      ),
    ],
    sections: [
      sectionRenderer('editor', ({ title, items }) =>
        h(
          'dl',
          { 'data-custom': title },
          items.map((item) =>
            h(
              'div',
              { key: item.key, 'data-key': item.key },
              h('dt', null, item.label),
              h('dd', null, item.control, item.feedback),
            ),
          ),
        ),
      ),
    ],
  });
  const section = defineSettingsSection({ id: 'editor', title: 'Editor', settings: [editor] });
  const view = await mount(
    h(
      SettingsProvider,
      { settings },
      h(SettingsUIProvider, { renderers }, h(SettingsSectionView, { section })),
    ),
  );
  try {
    const { host } = view;
    await settle();
    assert.equal(host.querySelector('dl').dataset.custom, 'Editor');
    assert.deepEqual(
      [...host.querySelectorAll('[data-key]')].map((node) => node.dataset.key),
      ['editor.density', 'editor.autosave', 'editor.signature', 'editor.pageSize'],
    );
    const button = host.querySelector('[data-key="editor.pageSize"] button');
    assert.equal(document.querySelector(`label[for="${button.id}"]`).textContent, 'Page size');
    await act(async () => button.click());
    await settle();
    assert.equal(storage.values.get('editor.pageSize'), 25);
    assert.equal(button.textContent, 'Rows: 25');
  } finally {
    await view.unmount();
  }
});

test('missing registrations and unknown variants render configuration alerts instead of falling back', async () => {
  const editor = preferences();
  const odd = defineSettings({
    id: 'odd',
    fields: {
      color: choiceField({
        options: ['red'],
        defaultValue: 'red',
        presentation: { variant: 'swatches' },
      }),
    },
  });
  const settings = createAppPreferences({ storage: createMemoryStorage() });
  settings.register(odd, { owner: 'odd' });
  const originalError = console.error;
  console.error = () => {};
  const view = await mount(
    h(
      SettingsProvider,
      { settings },
      h(SettingsField, { setting: editor.fields.autosave }),
      h(SettingsField, { setting: odd.fields.color }),
    ),
  );
  try {
    const alerts = [...view.host.querySelectorAll('[role=alert]')].map((node) => node.textContent);
    assert.match(alerts[0], /Setting "editor.autosave" is referenced but not registered/);
    assert.match(alerts[1], /Unknown variant "swatches" for choice setting "odd.color"/);
    await act(async () => settings.register(editor, { owner: 'editor' }));
    assert.ok(view.host.querySelector('[role=switch]'), 'a later registration renders the field');
  } finally {
    console.error = originalError;
    await view.unmount();
  }
});

test('standalone server markup hydrates without mismatches', async () => {
  const make = () => {
    const editor = preferences();
    const settings = createAppPreferences({ storage: createMemoryStorage() });
    settings.register(editor, { owner: 'editor' });
    settings.add(defineSettingsSection({ id: 'editor', title: 'Editor', settings: [editor] }));
    return settings;
  };
  const element = (settings) => h(SettingsProvider, { settings }, h(SettingsView));
  const host = document.createElement('div');
  host.innerHTML = renderToString(element(make()));
  document.body.append(host);
  const errors = [];
  let root;
  await act(async () => {
    root = hydrateRoot(host, element(make()), {
      onRecoverableError: (error) => errors.push(error.message),
    });
  });
  try {
    assert.deepEqual(errors, []);
    await settle();
    assert.equal(host.querySelector('[role=switch]').disabled, false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('standard multi-choice cards keep independent selections and horizontal layout', async () => {
  const { multiChoiceField } = await import('../dist/index.js');
  const collection = defineSettings({
    id: 'tools',
    fields: {
      enabled: multiChoiceField({
        title: 'Tools',
        options: ['search', 'export'],
        defaultValue: [],
        presentation: { variant: 'cards', orientation: 'horizontal' },
      }),
    },
  });
  const storage = createMemoryStorage();
  const settings = createAppPreferences({ storage });
  settings.register(collection, { owner: 'app' });
  await settings.activate({});
  const view = await mount(
    h(SettingsProvider, { settings }, h(SettingsField, { setting: collection.fields.enabled })),
  );
  try {
    const controls = [...view.host.querySelectorAll('[role=checkbox]')];
    assert.equal(controls.length, 2);
    await act(async () => controls[0].click());
    await act(async () => controls[1].click());
    assert.deepEqual(settings.get(collection.fields.enabled).value, ['search', 'export']);
    await act(async () => controls[0].click());
    assert.deepEqual(storage.values.get('tools.enabled'), ['export']);
    assert.equal(controls[1].getAttribute('aria-checked'), 'true');
    assert.ok(view.host.querySelector('.flex-wrap'));
    assert.equal(view.host.querySelectorAll('[data-slot=field]').length, 2);
  } finally {
    await view.unmount();
  }
});

test('individual reset removes only its override, disables while pending and supports retry', async () => {
  const editor = preferences();
  let gate;
  const resets = [];
  const settings = createAppPreferences({
    storage: {
      async load(key) {
        return { value: key.endsWith('density') ? 'compact' : undefined, writable: true };
      },
      async save() {},
      async reset(key) {
        resets.push(key);
        gate = deferred();
        return gate.promise;
      },
    },
  });
  settings.register(editor, { owner: 'editor' });
  const view = await mount(
    h(SettingsProvider, { settings }, h(SettingsField, { setting: editor.fields.density })),
  );
  await settle();
  try {
    const button = view.host.querySelector('button[aria-label="Reset to default: Density"]');
    assert.ok(button);
    assert.equal(button.type, 'button');
    await act(async () => button.click());
    assert.equal(button.disabled, true);
    assert.equal(
      settings.get(editor.fields.density).value,
      'compact',
      'pending reset is not confirmed',
    );
    await act(async () => gate.reject(new Error('offline')));
    assert.equal(settings.get(editor.fields.density).value, 'compact');
    assert.match(view.host.textContent, /could not be saved/);
    assert.equal(button.disabled, false);
    await act(async () => button.click());
    await act(async () => gate.resolve({ writable: true }));
    assert.equal(settings.get(editor.fields.density).value, 'comfortable');
    assert.deepEqual(resets, ['editor.density', 'editor.density']);
    assert.doesNotMatch(view.host.textContent, /could not be saved/);
  } finally {
    await view.unmount();
  }
});

test('individual reset is unavailable for read-only or disabled fields', async () => {
  const editor = preferences();
  let writes = 0;
  const settings = createAppPreferences({
    storage: {
      async load() {
        return { writable: false };
      },
      async save() {
        writes++;
      },
    },
  });
  settings.register(editor, { owner: 'editor' });
  const view = await mount(
    h(SettingsProvider, { settings }, h(SettingsField, { setting: editor.fields.density })),
  );
  await settle();
  const button = view.host.querySelector('button[aria-label="Reset to default: Density"]');
  assert.equal(button.disabled, true);
  await act(async () => button.click());
  assert.equal(writes, 0);
  await view.unmount();
});
