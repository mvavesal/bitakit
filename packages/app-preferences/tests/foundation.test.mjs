import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

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
const { ActionProvider, createActionList } = await import('@bitakit/ui/actions');
const { FoundationProvider, getService, discoveredFile } = await import('@bitakit/ui');
const {
  createAppPreferences,
  createMemoryStorage,
  defineSettings,
  defineSettingsSection,
  defineSettingsRenderers,
  fieldRenderer,
  typeRenderer,
  choiceField,
  booleanField,
  numberField,
  textField,
  SettingsProvider,
  SettingsView,
} = await import('../dist/index.js');
const {
  appPreferencesPlugin,
  settingsRendererService,
  discoverSettings,
  discoverSettingsSections,
  discoverSettingsRenderers,
} = await import('../dist/foundation/index.js');

const box = ({ children }) => h('div', null, children);
const ui = {
  Dialog: box,
  DialogContent: box,
  DialogHeader: box,
  DialogTitle: box,
  DialogDescription: box,
  DialogFooter: box,
  Button: (props) => h('button', props),
  Input: (props) => h('input', { ...props, 'data-host-input': '' }),
  Field: box,
  FieldLabel: box,
  FieldGroup: box,
  FieldError: box,
  Menu: box,
};
const labels = {
  cancel: 'Cancel',
  submit: 'Submit',
  pending: 'Pending',
  invalid: 'Invalid',
  unavailable: 'Unavailable',
};
const marker = (name) =>
  Object.defineProperty(
    (props) =>
      h(
        'output',
        { id: props.id, 'data-renderer': name, 'aria-describedby': props.describedBy },
        String(props.value),
      ),
    'name',
    { value: name },
  );
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve)));

function app({ extraPlugins = [], setup, defaults, standalone = false } = {}) {
  const editor = defineSettings({
    id: 'editor',
    fields: {
      pageSize: numberField({ defaultValue: 20 }),
      density: choiceField({ options: ['comfortable', 'compact'], defaultValue: 'comfortable' }),
      autosave: booleanField({ defaultValue: true }),
    },
  });
  const other = defineSettings({
    id: 'other',
    fields: {
      mode: choiceField({ options: ['a', 'b'], defaultValue: 'a' }),
      note: textField({ defaultValue: '' }),
    },
  });
  const storage = createMemoryStorage();
  const settings = createAppPreferences({ storage });
  const config = {
    appId: 'content',
    contributions: {
      'settings.renderers': [
        defineSettingsRenderers({ types: [typeRenderer('boolean', marker('app-boolean'))] }),
      ],
    },
    setup,
    plugins: [
      {
        id: 'editor',
        contributions: {
          settings: [editor],
          'settings.sections': [
            defineSettingsSection({ id: 'editor', title: 'Editor', settings: [editor] }),
          ],
          'settings.renderers': [
            defineSettingsRenderers({
              fields: [fieldRenderer(editor.fields.pageSize, marker('plugin-page-size'))],
              types: [typeRenderer('choice', marker('plugin-choice'))],
            }),
          ],
        },
      },
      {
        id: 'other',
        contributions: {
          settings: [other],
          'settings.sections': [
            defineSettingsSection({ id: 'other', title: 'Other', settings: [other] }),
          ],
        },
      },
      ...extraPlugins,
    ],
  };
  const tree = (children = h(SettingsView)) =>
    standalone
      ? h(
          FoundationProvider,
          {
            config,
            plugins: [appPreferencesPlugin({ settings, defaults }), ...config.plugins],
            ui,
            labels,
          },
          children,
        )
      : h(
          SettingsProvider,
          { settings },
          h(
            ActionProvider,
            { actions: createActionList() },
            h(
              FoundationProvider,
              {
                config,
                plugins: [appPreferencesPlugin({ settings, defaults }), ...config.plugins],
                ui,
                labels,
              },
              children,
            ),
          ),
        );
  return { editor, other, settings, storage, tree };
}
const renderers = (host) =>
  [...host.querySelectorAll('[data-renderer]')].map((node) => node.dataset.renderer).sort();

test('server, hydration and mounted renders select the same contributed renderers without a flash', async () => {
  const server = app({ standalone: true });
  const html = renderToString(server.tree());
  assert.match(
    html,
    /data-renderer="plugin-page-size"/,
    'custom renderers are already in the server markup',
  );
  assert.match(html, /data-renderer="plugin-choice"/);
  assert.match(html, /data-renderer="app-boolean"/);
  const client = app({ standalone: true });
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const before = renderers(host);
  const errors = [];
  let root;
  await act(async () => {
    root = hydrateRoot(host, client.tree(), {
      onRecoverableError: (error) => errors.push(error.message),
    });
  });
  try {
    await settle();
    assert.deepEqual(errors, []);
    assert.deepEqual(renderers(host), before, 'post-mount resolution equals the initial snapshot');
    assert.equal(client.settings.ownersOf(client.editor.fields.pageSize)[0], 'editor');
    assert.equal(
      client.settings.get(client.editor.fields.pageSize).ready,
      true,
      'values load after mount',
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('installers own definitions, sections and layered renderers; closing a view keeps data', async () => {
  const { editor, other, settings, storage, tree } = app();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(tree()));
  await settle();
  try {
    const sections = settings.getSections().map((section) => [section.id, section.pluginId]);
    assert.deepEqual(sections, [
      ['editor', 'editor'],
      ['other', 'other'],
    ]);
    const otherButton = [...host.querySelectorAll('nav button')].find(
      (button) => button.textContent === 'Other',
    );
    await act(async () => otherButton.click());
    assert.ok(
      host.querySelector('[role=combobox]'),
      "the editor plugin's choice renderer does not restyle other plugins",
    );
    assert.ok(
      host.querySelector('[data-slot=input]'),
      'text fields use the package standard Input',
    );
    await act(async () => root.render(tree(h('p', null, 'closed'))));
    assert.ok(settings.has(editor.fields.pageSize), 'closing a view preserves data registrations');
    await act(async () => root.render(h('p', null, 'unmounted')));
    assert.equal(
      settings.has(editor.fields.pageSize),
      false,
      'unmounting the runtime releases registrations',
    );
    assert.equal(settings.has(other.fields.mode), false);
    assert.deepEqual(settings.getSections(), []);
    assert.equal(storage.values.size, 0);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('imperative registration is scoped to the calling module and restored on cleanup', async () => {
  const pluginText = marker('scoped-text');
  const appNumber = marker('app-number');
  const extension = defineSettings({
    id: 'extension',
    fields: { label: textField({ defaultValue: 'x' }) },
  });
  let service;
  const scoped = {
    id: 'other-extension',
    contributions: {
      settings: [extension],
      'settings.sections': [
        defineSettingsSection({ id: 'extension', title: 'Extension', settings: [extension] }),
      ],
    },
    setup: ({ app: scope, services }) => {
      service = getService(services, settingsRendererService);
      service.scoped(scope).registerType('text', { component: pluginText });
      assert.throws(
        () => service.scoped(scope).registerView('settings', { component: box }),
        /Only the application/,
      );
    },
  };
  const { tree, other, editor } = app({
    extraPlugins: [scoped],
    setup: ({ app: scope, services }) =>
      void getService(services, settingsRendererService)
        .scoped(scope)
        .registerType('number', { component: appNumber }),
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(tree()));
  await settle();
  try {
    assert.deepEqual(renderers(host), ['app-boolean', 'plugin-choice', 'plugin-page-size']);
    const open = async (title) => {
      const button = [...host.querySelectorAll('nav button')].find(
        (node) => node.textContent === title,
      );
      await act(async () => button.click());
    };
    await open('Other');
    assert.equal(
      host.querySelector('[data-renderer="scoped-text"]'),
      null,
      'a plugin type renderer skips fields it does not own',
    );
    await open('Extension');
    assert.ok(host.querySelector('[data-renderer="scoped-text"]'), 'and applies to its own fields');
    const resolve = (setting, owners) =>
      service.getSnapshot().resolveField(setting, owners).component.name;
    assert.equal(resolve(editor.fields.pageSize, ['editor']), 'plugin-page-size');
    assert.equal(resolve(other.fields.mode, ['other']), 'SelectControl');
    await act(async () => root.render(h('p', null, 'unmounted')));
    assert.equal(
      resolve(extension.fields.label, ['other-extension']),
      'TextControl',
      'cleanup restores the fallback',
    );
    assert.equal(resolve(editor.fields.pageSize, ['editor']), 'NumberControl');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('normalizers validate exports and name the source file', () => {
  const file = (value, source) => discoveredFile(value, '', source);
  assert.throws(
    () => discoverSettings([file({ id: 'x' }, 'settings/bad.ts')], 'content'),
    /Invalid settings export in settings\/bad.ts \(content\)/,
  );
  assert.throws(
    () => discoverSettingsSections([file({ id: 'x' }, 'sections/bad.tsx')], 'content'),
    /Invalid settings section export in sections\/bad.tsx \(content\)/,
  );
  assert.throws(
    () => discoverSettingsRenderers([file({ field: [] }, 'renderers/bad.tsx')], 'content'),
    /Unknown key "field" in settings renderers of renderers\/bad.tsx \(content\)/,
  );
  assert.throws(
    () =>
      discoverSettingsRenderers(
        [file({ types: [{ kind: 'type', type: 'color', component: box }] }, 'renderers/color.tsx')],
        'content',
      ),
    /Unknown setting type "color" in renderers\/color.tsx \(content\)/,
  );
  const single = discoverSettingsRenderers(
    [file(typeRenderer('text', box), 'renderers/text.tsx')],
    'content',
  );
  assert.equal(single[0].types.length, 1);
  const collection = defineSettings({
    id: 'renamed',
    fields: { flag: booleanField({ defaultValue: false }) },
  });
  const [first] = discoverSettings([file(collection, 'settings/old-name.ts')], 'content');
  const [second] = discoverSettings([file(collection, 'settings/new-name.ts')], 'content');
  assert.equal(first.settings[0].key, second.settings[0].key, 'renaming a file keeps keys');
});

test('custom defaults are identical before hydration and after service installation', async () => {
  const defaults = { types: [typeRenderer('text', marker('custom-default'))] };
  const server = app({ defaults });
  const html = renderToString(server.tree(h(SettingsView, { section: 'other' })));
  assert.match(html, /data-renderer="custom-default"/);
  const client = app({ defaults });
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const errors = [];
  let root;
  await act(async () => {
    root = hydrateRoot(host, client.tree(h(SettingsView, { section: 'other' })), {
      onRecoverableError: (error) => errors.push(error),
    });
  });
  try {
    await settle();
    assert.deepEqual(errors, []);
    assert.ok(host.querySelector('[data-renderer="custom-default"]'));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('discovered setting references render before mount and bind to the same persisted value', async () => {
  const { useFoundationApp } = await import('@bitakit/ui');
  const { SettingToggle } = await import('../dist/index.js');
  const makeView = () => {
    const settings = createAppPreferences({ storage: createMemoryStorage() });
    const definitions = discoverSettings([discoveredFile(defineSettings({ fields: {
      autosave: booleanField({ title: 'Auto save', defaultValue: true }),
    } }), 'editor', 'settings/editor.ts')], 'documents');
    const config = { plugins: [appPreferencesPlugin({ settings }), {
      id: 'documents', contributions: { settings: definitions },
    }] };
    function Content() {
      return h(SettingToggle, { setting: useFoundationApp().settings.documents.editor.autosave });
    }
    return { settings, view: h(FoundationProvider, { config, ui }, h(Content)) };
  };
  const host = document.createElement('div');
  host.innerHTML = renderToString(makeView().view);
  assert.equal(host.querySelector('input').checked, true);
  assert.equal(host.querySelector('input').disabled, true);
  document.body.append(host);
  const client = makeView();
  const errors = [];
  let root;
  try {
    await act(async () => {
      root = hydrateRoot(host, client.view, { onRecoverableError: error => errors.push(error.message) });
    });
    assert.deepEqual(errors, []);
    assert.equal(host.querySelector('input').disabled, false);
    await act(async () => host.querySelector('input').click());
    assert.equal(client.settings.get(client.settings.getDefinitions()[0]).value, false);
  } finally {
    await act(async () => root?.unmount());
    host.remove();
  }
});
