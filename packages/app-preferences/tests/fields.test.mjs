import { blur, click, controlledStorage, press, renderApp, text, tick, type } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement as h } from 'react';
import { definePlugin, defineSettings, setting } from '@bitakit/core';
import { useSettingsCatalog } from '@bitakit/ui';
import { SettingField, SettingsFields, controlFor } from '../dist/index.js';
import { appPreferencesPlugin } from '../dist/foundation.js';

const ListIcon = (props) => h('svg', { ...props, 'data-icon-name': 'list' });
const positive = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) =>
      typeof value === 'number' && value > 0
        ? { value }
        : { issues: [{ message: 'Enter a positive number.' }] },
  },
};
const prefs = definePlugin({
  id: 'prefs',
  settings: defineSettings({
    enabled: setting({ default: false, label: 'Enabled', description: 'Turns it on.' }),
    theme: setting({
      default: 'system',
      label: 'Theme',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'system', label: 'System' },
      ],
    }),
    density: setting({
      default: 'comfortable',
      label: 'Density',
      control: 'radio',
      options: [
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact', description: 'More rows.' },
      ],
    }),
    layout: setting({
      default: 'list',
      label: 'Layout',
      control: 'cards',
      options: [
        { value: 'list', label: 'List', icon: ListIcon },
        { value: 'grid', label: 'Grid', description: 'Tiles.' },
      ],
    }),
    name: setting({ default: 'Ada', label: 'Name' }),
    bio: setting({ default: '', label: 'Bio', control: 'textarea' }),
    pageSize: setting({ default: 20, label: 'Page size', schema: positive }),
    tags: setting({ default: ['a'], label: 'Tags', group: 'advanced' }),
    // No standard control edits an object: a custom page would.
    position: setting({ default: { x: 0, y: 0 }, label: 'Position', group: 'advanced' }),
    channels: setting({
      default: ['email'],
      label: 'Channels',
      options: [
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'SMS' },
        { value: 'push', label: 'Push' },
      ],
    }),
    secret: setting({ default: 'hush', label: 'Secret', hidden: true }),
  }),
});
const config = { plugins: [appPreferencesPlugin(), prefs] };

async function choose(container, label) {
  const trigger = container.querySelector('[role=combobox]');
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await act(tick);
  const option = [...document.querySelectorAll('[role=option]')].find(
    (node) => text(node) === label,
  );
  assert.ok(option, `option ${label} is listed`);
  await press(option, 'Enter');
  await act(tick);
}
const radio = (container, label) =>
  [...container.querySelectorAll('[role=radio]')].find(
    (node) => text(document.getElementById(node.getAttribute('aria-labelledby'))) === label,
  );
const checkedRadio = (container) => {
  const node = container.querySelector('[role=radio][aria-checked=true]');
  return node && text(document.getElementById(node.getAttribute('aria-labelledby')));
};
const edit = async (container, selector, value) => {
  const input = container.querySelector(selector);
  await type(input, value);
  await blur(input);
};

/** Every control kind: how to change it and what it currently shows. */
const kinds = [
  {
    key: 'prefs.enabled',
    next: true,
    change: (container) => click(container.querySelector('[role=switch]')),
    shown: (container) => container.querySelector('[role=switch]').getAttribute('aria-checked'),
    initial: 'false',
    changed: 'true',
  },
  {
    key: 'prefs.theme',
    next: 'dark',
    change: (container) => choose(container, 'Dark'),
    shown: (container) => text(container.querySelector('[role=combobox]')),
    initial: 'System',
    changed: 'Dark',
  },
  {
    key: 'prefs.density',
    next: 'compact',
    change: (container) => click(radio(container, 'Compact')),
    shown: checkedRadio,
    initial: 'Comfortable',
    changed: 'Compact',
  },
  {
    key: 'prefs.layout',
    next: 'grid',
    change: (container) => click(radio(container, 'Grid')),
    shown: checkedRadio,
    initial: 'List',
    changed: 'Grid',
  },
  {
    key: 'prefs.name',
    next: 'Grace',
    change: (container) => edit(container, 'input[type=text]', 'Grace'),
    shown: (container) => container.querySelector('input[type=text]').value,
    initial: 'Ada',
    changed: 'Grace',
  },
  {
    key: 'prefs.bio',
    next: 'Hello',
    change: (container) => edit(container, 'textarea', 'Hello'),
    shown: (container) => container.querySelector('textarea').value,
    initial: '',
    changed: 'Hello',
  },
  {
    key: 'prefs.pageSize',
    next: 50,
    change: (container) => edit(container, 'input[type=number]', '50'),
    shown: (container) => container.querySelector('input[type=number]').value,
    initial: '20',
    changed: '50',
  },
];

for (const kind of kinds)
  test(`SettingField ${kind.key}: writes, shows saving, keeps the confirmed value on failure and resets`, async () => {
    const storage = controlledStorage();
    const view = await renderApp(h(SettingField, { settingKey: kind.key }), { config, storage });
    const { container } = view;
    const status = () => container.querySelector('[role=status]');
    const alert = () => container.querySelector('[role=alert]');
    const label = text(container.querySelector('[data-slot=field-label]'));
    const resetButton = () =>
      container.querySelector(`button[aria-label="Reset ${label} to default"]`);
    try {
      assert.equal(kind.shown(container), kind.initial);
      assert.equal(resetButton(), null, 'nothing to reset at the default');

      storage.hold();
      await kind.change(container);
      assert.equal(text(status()), 'Saving…', 'a running write shows its state as text');
      storage.release();
      await act(tick);
      assert.equal(status(), null);
      assert.deepEqual(storage.data.get(kind.key), kind.next);
      assert.equal(kind.shown(container), kind.changed);
      assert.ok(resetButton(), 'a changed value can be reset');

      storage.fail('offline');
      await click(resetButton());
      await act(tick);
      assert.match(text(alert()), /The change could not be saved: offline/);
      assert.equal(kind.shown(container), kind.changed, 'the confirmed value stays');
      assert.deepEqual(storage.data.get(kind.key), kind.next);

      storage.succeed();
      await click(resetButton());
      await act(tick);
      assert.equal(alert(), null, 'a successful write clears the error');
      assert.equal(storage.data.has(kind.key), false);
      assert.equal(kind.shown(container), kind.initial);
      assert.equal(resetButton(), null);
    } finally {
      await view.unmount();
    }
  });

test('controls are inferred from the value or chosen by spec.control', async () => {
  let fields;
  function Probe() {
    fields = useSettingsCatalog().find((section) => section.id === 'prefs').fields;
    return null;
  }
  const view = await renderApp(h(Probe), { config, storage: controlledStorage() });
  try {
    assert.deepEqual(
      Object.fromEntries(fields.map((field) => [field.name, controlFor(field)?.name])),
      {
        enabled: 'SwitchControl',
        theme: 'SelectControl',
        density: 'RadioControl',
        layout: 'CardsControl',
        name: 'TextControl',
        bio: 'TextareaControl',
        pageSize: 'NumberControl',
        tags: 'ListControl',
        position: undefined,
        channels: 'CheckboxesControl',
      },
    );
  } finally {
    await view.unmount();
  }
});

test('a list adds and removes short texts; checkboxes choose several options in their order', async () => {
  const storage = controlledStorage();
  const view = await renderApp(
    h('div', null, [
      h(SettingField, { key: 'tags', settingKey: 'prefs.tags' }),
      h(SettingField, { key: 'channels', settingKey: 'prefs.channels' }),
    ]),
    { config, storage },
  );
  const { container } = view;
  try {
    const tags = container.querySelector('[data-setting="prefs.tags"]');
    const input = tags.querySelector('input');
    assert.equal(
      text(tags.querySelector(`label[for="${input.id}"]`)),
      'Tags',
      'the label names the box',
    );
    await type(input, ' b ');
    await press(input, 'Enter');
    await act(tick);
    assert.deepEqual(storage.data.get('prefs.tags'), ['a', 'b']);
    assert.equal(input.value, '', 'the box empties after adding');
    await type(input, 'a');
    await press(input, 'Enter');
    await act(tick);
    assert.deepEqual(storage.data.get('prefs.tags'), ['a', 'b'], 'an entry is listed once');
    await click(tags.querySelector('button[aria-label="Remove a"]'));
    await act(tick);
    assert.deepEqual(storage.data.get('prefs.tags'), ['b']);

    const channels = container.querySelector('[data-setting="prefs.channels"] [role=group]');
    assert.equal(channels.getAttribute('aria-label'), 'Channels');
    const box = (label) =>
      [...channels.querySelectorAll('[role=checkbox]')].find(
        (node) => text(channels.querySelector(`label[for="${node.id}"]`)) === label,
      );
    assert.equal(box('Email').getAttribute('aria-checked'), 'true');
    await click(box('Push'));
    await act(tick);
    await click(box('SMS'));
    await act(tick);
    assert.deepEqual(storage.data.get('prefs.channels'), ['email', 'sms', 'push'], 'option order');
    await click(box('Email'));
    await act(tick);
    assert.deepEqual(storage.data.get('prefs.channels'), ['sms', 'push']);
  } finally {
    await view.unmount();
  }
});

test('labels, descriptions and option details are connected to their controls', async () => {
  const view = await renderApp(
    h('div', null, [
      h(SettingField, { key: 'enabled', settingKey: 'prefs.enabled' }),
      h(SettingField, { key: 'density', settingKey: 'prefs.density' }),
      h(SettingField, { key: 'layout', settingKey: 'prefs.layout' }),
    ]),
    { config, storage: controlledStorage() },
  );
  const { container } = view;
  try {
    const toggle = container.querySelector('[role=switch]');
    assert.equal(text(container.querySelector(`label[for="${toggle.id}"]`)), 'Enabled');
    const described = toggle.getAttribute('aria-describedby').split(' ');
    assert.equal(text(document.getElementById(described[0])), 'Turns it on.');
    assert.ok(document.getElementById(described[1]), 'the feedback region is referenced');

    const [density, layout] = container.querySelectorAll('[role=radiogroup]');
    assert.equal(density.getAttribute('aria-label'), 'Density');
    assert.equal(layout.getAttribute('aria-label'), 'Layout');
    const compact = radio(container, 'Compact');
    assert.equal(
      text(document.getElementById(compact.getAttribute('aria-describedby'))),
      'More rows.',
    );
    const card = radio(container, 'List').closest('label');
    assert.ok(card, 'cards are labels around the whole option');
    assert.ok(
      card.querySelector('[data-icon-name=list][aria-hidden=true]'),
      'decorative option icon',
    );
    assert.equal(card.querySelector('[data-slot=field]').dataset.checked, 'true');
    assert.equal(radio(container, 'Grid').closest('label').querySelector('[data-checked]'), null);
  } finally {
    await view.unmount();
  }
});

test('validation failures show the reason and keep the entry for correction', async () => {
  const storage = controlledStorage();
  const view = await renderApp(h(SettingField, { settingKey: 'prefs.pageSize' }), {
    config,
    storage,
  });
  const { container } = view;
  try {
    const input = container.querySelector('input[type=number]');
    await type(input, '-5');
    await press(input, 'Enter');
    await act(tick);
    assert.match(text(container.querySelector('[role=alert]')), /Enter a positive number\./);
    assert.equal(input.value, '-5', 'the rejected entry stays visible');
    assert.equal(storage.writes.length, 0, 'nothing reached storage');
    await press(input, 'Escape');
    assert.equal(input.value, '20', 'Escape restores the confirmed value');
    await type(input, '');
    await blur(input);
    assert.equal(input.value, '20', 'an empty number is not a value');
    await type(input, '30');
    await blur(input);
    await act(tick);
    assert.equal(container.querySelector('[role=alert]'), null);
    assert.equal(storage.data.get('prefs.pageSize'), 30);
  } finally {
    await view.unmount();
  }
});

test('read-only and failed loads explain themselves; hidden settings render by key', async () => {
  const storage = {
    load: (key) => {
      if (key === 'prefs.theme') throw new Error('server down');
      return { value: undefined, writable: key !== 'prefs.enabled' };
    },
    save() {},
  };
  const view = await renderApp(
    h('div', null, [
      h(SettingField, { key: 'enabled', settingKey: 'prefs.enabled' }),
      h(SettingField, { key: 'theme', settingKey: 'prefs.theme' }),
      h(SettingField, { key: 'secret', settingKey: 'prefs.secret' }),
    ]),
    { config, storage },
  );
  const { container } = view;
  try {
    const [enabled, theme, secret] = container.querySelectorAll('[data-setting]');
    assert.match(text(enabled), /You cannot change this setting\./);
    assert.equal(enabled.querySelector('[role=switch]').disabled, true);
    assert.equal(enabled.querySelector('button[aria-label^="Reset"]'), null);
    assert.match(text(theme.querySelector('[role=alert]')), /could not be loaded: server down/);
    assert.equal(theme.querySelector('[role=combobox]').disabled, true);
    assert.equal(secret.dataset.setting, 'prefs.secret');
    assert.equal(secret.querySelector('input').value, 'hush');
  } finally {
    await view.unmount();
  }
});

test('SettingsFields renders one card, grouped cards, exclusions and an empty state', async () => {
  let section;
  function Fields(props) {
    section = useSettingsCatalog().find((entry) => entry.id === 'prefs');
    return h(SettingsFields, { section, ...props });
  }
  const messages = { 'prefs.settings.groups.advanced': 'Advanced options' };
  const translate = Object.assign((key) => messages[key] ?? key, {
    has: (key) => Object.hasOwn(messages, key),
  });
  const view = await renderApp(h(Fields, { exclude: ['prefs.bio'] }), {
    config,
    storage: controlledStorage(),
    translate,
  });
  try {
    const cards = view.container.querySelectorAll('[data-slot=card]');
    assert.equal(cards.length, 2, 'ungrouped fields, then one card per group');
    assert.equal(cards[0].querySelectorAll('[data-setting]').length, 7);
    assert.equal(view.container.querySelector('[data-setting="prefs.bio"]'), null);
    assert.equal(text(view.container.querySelector('legend')), 'Advanced options');
    assert.ok(cards[1].querySelector('[data-setting="prefs.tags"]'));
    assert.match(text(cards[1]), /This setting cannot be changed here\./);
  } finally {
    await view.unmount();
  }
  const empty = await renderApp(h(SettingsFields, { fields: [] }), { config });
  try {
    assert.equal(text(empty.container), 'This section has no settings.');
  } finally {
    await empty.unmount();
  }
});

test('a setting named in the address is scrolled to, focused and marked; settingHref links it', async () => {
  const { settingHref, settingAnchor } = await import('../dist/index.js');
  assert.equal(settingAnchor('prefs.theme'), 'setting-prefs.theme');
  assert.equal(
    settingHref('/settings', { path: 'prefs' }, 'prefs.theme'),
    '/settings/prefs#setting-prefs.theme',
  );
  assert.equal(settingHref('/', { path: 'prefs' }, 'prefs.theme'), '/prefs#setting-prefs.theme');

  const scrolled = [];
  const original = window.Element.prototype.scrollIntoView;
  window.Element.prototype.scrollIntoView = function () {
    scrolled.push(this.id);
  };
  window.location.hash = '#setting-prefs.name';
  const view = await renderApp(
    h('div', null, [
      h(SettingField, { key: 'enabled', settingKey: 'prefs.enabled' }),
      h(SettingField, { key: 'name', settingKey: 'prefs.name' }),
    ]),
    { config, storage: controlledStorage() },
  );
  const field = (key) => view.container.querySelector(`[id="setting-${key}"]`);
  try {
    await act(tick);
    assert.ok(field('prefs.name'), 'the field has its anchor id');
    assert.equal(field('prefs.name').getAttribute('data-linked'), 'true');
    // Scrolled to it (the provider may mount the page twice while it starts; each reveals the same field).
    assert.equal(scrolled.at(-1), 'setting-prefs.name');
    assert.equal(document.activeElement, field('prefs.name').querySelector('input'));
    assert.equal(field('prefs.enabled').getAttribute('data-linked'), null);

    // A later hash change brings another setting into view.
    window.location.hash = '#setting-prefs.enabled';
    await act(async () => window.dispatchEvent(new window.HashChangeEvent('hashchange')));
    assert.equal(field('prefs.enabled').getAttribute('data-linked'), 'true');
    assert.equal(scrolled.at(-1), 'setting-prefs.enabled');
  } finally {
    window.Element.prototype.scrollIntoView = original;
    window.location.hash = '';
    await view.unmount();
  }
});
