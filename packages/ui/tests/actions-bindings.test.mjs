import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act, memo } from 'react';
import { installDom, mount, click, deferred, testUI } from './support.mjs';
import { ActionProvider, useAction, Action, ActionButton, ActionLink } from '../dist/actions/index.js';
import { createActionList } from '@bitakit/core';
import { BitaKitRuntimeProvider } from '../dist/index.js';
import { defineAction, definePlugin } from '@bitakit/core';

installDom();

/** Captures the control of one action for one input so the test can read state and call getters. */
const controls = {};
function Probe({ name, id, input }) {
  controls[name] = useAction(id, input);
  return null;
}
const fakeClick = (overrides = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
  ...overrides,
});

test('useAction exposes the resolved state for its input, guarded execution and button props', async () => {
  const received = [];
  const errors = [];
  const list = createActionList([
    {
      id: 'save',
      title: 'Save',
      description: 'Save the document',
      tooltip: 'Save now',
      execute: ({ input }) => {
        if (input === 'bad') throw new Error('Cannot save');
        received.push(input);
        return `saved:${input}`;
      },
    },
  ]);
  const view = await mount(
    h(
      ActionProvider,
      { actions: list, onError: (error) => errors.push(error.message) },
      h(Probe, { name: 'save', id: 'save', input: 42 }),
      h(Probe, { name: 'missing', id: 'missing' }),
    ),
  );
  try {
    assert.equal(controls.missing, undefined, 'unregistered actions have no control');
    const save = controls.save;
    assert.deepEqual(
      [
        save.id,
        save.title,
        save.description,
        save.tooltip,
        save.enabled,
        save.visible,
        save.pending,
        save.disabled,
        save.status,
      ],
      ['save', 'Save', 'Save the document', 'Save now', true, true, false, false, 'idle'],
    );
    const props = save.props();
    assert.equal(props.type, 'button');
    assert.equal(props.disabled, false);
    assert.equal(props.title, 'Save now', 'the tooltip is the hover hint');
    assert.equal(props['aria-busy'], undefined);
    assert.equal(typeof props.onClick, 'function');
    await act(async () => {
      assert.deepEqual(
        await save.execute(),
        { status: 'completed', value: 'saved:42' },
        'execute defaults to the bound input',
      );
      assert.deepEqual(
        await save.execute(7),
        { status: 'completed', value: 'saved:7' },
        'an explicit value wins',
      );
    });
    assert.deepEqual(received, [42, 7]);
    const outcomes = [];
    await act(async () => save.props({ onExecuted: (result) => outcomes.push(result) }).onClick());
    assert.deepEqual(outcomes, [{ status: 'completed', value: 'saved:42' }]);
    await act(async () =>
      controls.save.execute('bad').catch((error) => errors.push(`rejected:${error.message}`)),
    );
    assert.deepEqual(
      errors,
      ['rejected:Cannot save'],
      'execute() itself rejects; props() routes failures to onError',
    );
    const local = [];
    await act(async () =>
      controls.save.props({ onError: (error) => local.push(error.message) }).onClick(),
    );
    await act(async () => controls.save.execute('bad').catch(() => {}));
    assert.deepEqual(local, [], 'the bound input succeeds, so the local handler sees nothing');
    await act(async () => {
      list.update('save', {
        execute: () => {
          throw new Error('Broken');
        },
      });
    });
    await act(async () =>
      controls.save.props({ onError: (error) => local.push(error.message) }).onClick(),
    );
    assert.deepEqual(local, ['Broken']);
    assert.deepEqual(
      errors,
      ['rejected:Cannot save'],
      'a local onError replaces the provider handler',
    );
    await act(async () => controls.save.props().onClick());
    assert.deepEqual(
      errors,
      ['rejected:Cannot save', 'Broken'],
      'without one, the provider handler receives it',
    );
    await act(async () => {
      list.update('save', { enabled: false, tooltip: undefined });
    });
    assert.equal(controls.save.disabled, true);
    assert.equal(controls.save.props().disabled, true);
    assert.equal(
      controls.save.props().title,
      'Save the document',
      'the description is the fallback hint',
    );
    await act(async () => {
      list.update('save', { visible: false });
    });
    assert.equal(
      controls.save.visible,
      false,
      'hidden actions keep a control; components decide what to render',
    );
  } finally {
    await view.unmount();
  }
});

test('pending is tracked per input for per-input actions and per action for exclusive ones', async () => {
  const gates = new Map();
  const wait = (key) => {
    const gate = deferred();
    gates.set(key, gate);
    return gate.promise;
  };
  const list = createActionList([
    {
      id: 'remove',
      title: 'Remove',
      concurrency: 'per-input',
      execute: ({ input }) => wait(`remove:${input}`),
    },
    { id: 'save', title: 'Save', execute: ({ input }) => wait(`save:${input}`) },
  ]);
  const view = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(Probe, { name: 'a', id: 'remove', input: 'a' }),
      h(Probe, { name: 'b', id: 'remove', input: 'b' }),
      h(Probe, { name: 'one', id: 'save', input: 1 }),
      h(Probe, { name: 'two', id: 'save', input: 2 }),
    ),
  );
  try {
    let removal;
    await act(async () => {
      removal = controls.a.execute();
    });
    assert.equal(controls.a.pending, true);
    assert.equal(controls.a.disabled, true);
    assert.equal(controls.a.props()['aria-busy'], true);
    assert.equal(controls.a.props()['data-pending'], true);
    assert.equal(
      controls.b.pending,
      false,
      'another input of a per-input action is still available',
    );
    assert.equal(controls.b.disabled, false);
    assert.deepEqual(controls.b.pendingKeys, ['a']);
    assert.equal(controls.b.status, 'pending', 'the action status is shared');
    await act(async () => {
      gates.get('remove:a').resolve();
      await removal;
    });
    assert.equal(controls.a.pending, false);
    assert.deepEqual(controls.a.pendingKeys, []);
    let saving;
    await act(async () => {
      saving = controls.one.execute();
    });
    assert.equal(controls.one.pending, true);
    assert.equal(controls.two.pending, true, 'exclusive actions are pending for every input');
    assert.deepEqual(await controls.two.execute(), { status: 'skipped', reason: 'pending' });
    await act(async () => {
      gates.get('save:1').resolve();
      await saving;
    });
    assert.equal(controls.two.pending, false);
  } finally {
    await view.unmount();
  }
});

test('linkProps navigate client-side for internal hrefs, leave external and modified clicks to the browser and disable safely', async () => {
  const visits = [];
  const list = createActionList([
    { id: 'docs', title: 'Docs', tooltip: 'Open the docs', href: '/docs' },
    { id: 'site', title: 'Site', href: 'https://example.com/' },
    { id: 'locked', title: 'Locked', href: '/locked', enabled: false },
    { id: 'plain', title: 'Plain' },
  ]);
  const view = await mount(
    h(
      ActionProvider,
      { actions: list, navigate: (href) => visits.push(href) },
      h(Probe, { name: 'docs', id: 'docs' }),
      h(Probe, { name: 'site', id: 'site' }),
      h(Probe, { name: 'locked', id: 'locked' }),
      h(Probe, { name: 'plain', id: 'plain' }),
    ),
  );
  try {
    const outcomes = [];
    const docs = controls.docs.linkProps({ onExecuted: (result) => outcomes.push(result) });
    const contextual = controls.docs.linkProps({ href: '/docs?q=labels' });
    assert.equal(contextual.href, '/docs?q=labels');
    contextual.onClick(fakeClick());
    assert.equal(visits.pop(), '/docs?q=labels', 'native contextual URL and client navigation agree');
    const unsafe = controls.docs.linkProps({ href: 'javascript:alert(1)' });
    assert.equal(unsafe.href, undefined);
    const unsafeEvent = fakeClick(); unsafe.onClick(unsafeEvent);
    assert.equal(unsafeEvent.defaultPrevented, true);

    assert.equal(docs.href, '/docs');
    assert.equal(docs.title, 'Open the docs');
    assert.equal(docs['aria-disabled'], undefined);
    assert.equal(docs.tabIndex, undefined);
    let event = fakeClick();
    docs.onClick(event);
    assert.deepEqual(visits, ['/docs']);
    assert.equal(event.defaultPrevented, true, 'the router handles the click');
    assert.deepEqual(outcomes, [{ status: 'completed', value: undefined }]);
    event = fakeClick({ metaKey: true });
    docs.onClick(event);
    assert.deepEqual(visits, ['/docs'], 'modified clicks keep the native new-tab behavior');
    assert.equal(event.defaultPrevented, false);
    event = fakeClick({ button: 1 });
    docs.onClick(event);
    assert.equal(event.defaultPrevented, false);
    const site = controls.site.linkProps();
    assert.equal(site.href, 'https://example.com/');
    event = fakeClick();
    site.onClick(event);
    assert.equal(event.defaultPrevented, false, 'external links are plain anchors');
    assert.deepEqual(visits, ['/docs']);
    const locked = controls.locked.linkProps();
    assert.equal(locked.href, undefined);
    assert.equal(locked['aria-disabled'], true);
    assert.equal(locked.tabIndex, -1);
    event = fakeClick();
    locked.onClick(event);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(visits, ['/docs']);
    const plain = controls.plain.linkProps();
    assert.equal(plain.href, undefined);
    assert.equal(plain['aria-disabled'], true, 'an action without href cannot be a link');
    await act(async () => {
      list.update('docs', { href: '/guide' });
    });
    controls.docs.linkProps().onClick(fakeClick());
    assert.deepEqual(visits, ['/docs', '/guide'], 'the current href is read at click time');
  } finally {
    await view.unmount();
  }
});

test('checkedProps, valueProps and menuItemProps bind toggles, choices and menu items', async () => {
  const list = createActionList([
    {
      id: 'preview',
      title: 'Preview',
      checked: false,
      execute: ({ input, update }) => update({ checked: input }),
    },
    {
      id: 'theme',
      title: 'Theme',
      value: 'light',
      variant: 'destructive',
      tooltip: 'Pick a theme',
      execute: ({ input, update }) => update({ value: input }),
    },
  ]);
  const selected = [];
  list.update('theme', {
    execute: ({ input, update }) => {
      selected.push(input);
      update({ value: input });
    },
  });
  const view = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(Probe, { name: 'preview', id: 'preview' }),
      h(Probe, { name: 'theme', id: 'theme' }),
      h(Probe, { name: 'dark', id: 'theme', input: 'dark' }),
    ),
  );
  try {
    const toggle = controls.preview.checkedProps();
    assert.deepEqual(
      [toggle.checked, toggle.disabled, toggle['aria-label']],
      [false, false, 'Preview'],
    );
    await act(async () => toggle.onCheckedChange(true));
    assert.equal(list.get('preview').checked, true);
    assert.equal(controls.preview.checked, true);
    assert.equal(
      controls.preview.props()['aria-pressed'],
      true,
      'buttons reflect the checked state as pressed',
    );
    const choice = controls.theme.valueProps();
    assert.equal(choice.value, 'light');
    await act(async () => choice.onValueChange('dark'));
    assert.equal(controls.theme.value, 'dark');
    const item = controls.dark.menuItemProps();
    assert.deepEqual(
      [item.disabled, item.variant, item.title, item['aria-busy']],
      [false, 'destructive', 'Pick a theme', undefined],
    );
    await act(async () => item.onSelect());
    assert.deepEqual(selected, ['dark', 'dark'], 'menu items execute with the control input');
    await act(async () => {
      list.update('theme', { enabled: false });
    });
    assert.equal(controls.theme.valueProps().disabled, true);
    assert.equal(controls.dark.menuItemProps().disabled, true);
  } finally {
    await view.unmount();
  }
});

test('provider-level control adapters remap prop names for other component libraries', async () => {
  const list = createActionList([
    { id: 'save', title: 'Save', execute() {} },
    { id: 'docs', title: 'Docs', href: '/docs' },
  ]);
  const controlsAdapter = {
    button: (state) => ({
      isDisabled: state.disabled,
      disabled: undefined,
      'data-title': state.title,
    }),
    link: (state) => ({ isDisabled: state.disabled }),
    toggle: (state) => ({ isSelected: state.checked }),
    choice: (state) => ({ selectedKey: state.value }),
    menuItem: (state) => ({ isDisabled: state.disabled }),
  };
  const view = await mount(
    h(
      ActionProvider,
      { actions: list, controls: controlsAdapter },
      h(Probe, { name: 'save', id: 'save' }),
      h(Probe, { name: 'docs', id: 'docs' }),
    ),
  );
  try {
    const props = controls.save.props();
    assert.equal(props.isDisabled, false);
    assert.equal(props.disabled, undefined, 'adapters override generated props');
    assert.equal(props['data-title'], 'Save');
    assert.equal(props.type, 'button', 'untouched props stay');
    assert.equal(controls.docs.linkProps().isDisabled, false);
    assert.equal(controls.docs.linkProps().href, '/docs');
    assert.equal(controls.save.checkedProps().isSelected, undefined);
    assert.equal(controls.save.valueProps().selectedKey, undefined);
    assert.equal(controls.save.menuItemProps().isDisabled, false);
    await act(async () => {
      list.update('save', { enabled: false });
    });
    assert.equal(controls.save.props().isDisabled, true);
  } finally {
    await view.unmount();
  }
  // The same adapters reach BitaKitRuntimeProvider as the `controls` prop.
  const config = { actions: { save: defineAction({ title: 'Save', execute() {} }) } };
  const foundation = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI, controls: { button: (state) => ({ isDisabled: state.disabled }) } },
      h(Probe, { name: 'save', id: 'save' }),
    ),
  );
  try {
    assert.equal(controls.save.props().isDisabled, false);
  } finally {
    await foundation.unmount();
  }
});

// Icon libraries export forwardRef/memo objects. A plain function would be read as a dynamic
// `icon: (context) => ...` resolver by Core, so the test mirrors the library shape.
const Icon = memo((props) => h('svg', { 'data-icon': 'plus', ...props }));

test('<Action> merges control props into its child: chained handlers, joined classes, combined disabled, auto content', async () => {
  const calls = [];
  const gate = deferred();
  const config = {
    actions: {
      add: defineAction({
        title: 'Add item',
        icon: Icon,
        execute: ({ input }) => calls.push(`add:${input}`),
      }),
      slow: defineAction({ title: 'Slow', execute: () => gate.promise }),
      locked: defineAction({ title: 'Locked', enabled: false, execute() {} }),
      hidden: defineAction({ title: 'Hidden', visible: false, execute() {} }),
    },
  };
  const controlsAdapter = { button: () => ({ className: 'btn' }) };
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI, controls: controlsAdapter },
      h(
        Action,
        { id: 'add', input: 3 },
        h('button', {
          'data-name': 'chained',
          className: 'own',
          onClick: () => calls.push('child'),
        }),
      ),
      h(Action, { id: 'add' }, h('button', { 'data-name': 'auto' })),
      h(Action, { id: 'add' }, h('button', { 'data-name': 'content' }, 'Custom')),
      h(
        Action,
        { id: 'add', input: 9 },
        h('button', { 'data-name': 'prevented', onClick: (event) => event.preventDefault() }),
      ),
      h(Action, { id: 'add' }, h('button', { 'data-name': 'child-disabled', disabled: true })),
      h(Action, { id: 'locked' }, h('button', { 'data-name': 'action-disabled' })),
      h(
        Action,
        { id: 'slow', pending: h('span', { 'data-spinner': true }) },
        h('button', { 'data-name': 'slow' }, 'Go'),
      ),
      h(Action, { id: 'hidden' }, h('button', { 'data-name': 'hidden' })),
      h(Action, { id: 'unknown' }, h('button', { 'data-name': 'unknown' })),
      h(Action, { id: 'add', input: 'fn' }, (control) =>
        h(
          'output',
          { 'data-name': 'render', onClick: () => control.execute() },
          `${control.title}:${control.enabled}`,
        ),
      ),
    ),
  );
  const find = (name) => view.container.querySelector(`[data-name="${name}"]`);
  try {
    await click(find('chained'));
    assert.deepEqual(
      calls,
      ['child', 'add:3'],
      'the child handler runs first, then the action with its input',
    );
    assert.equal(find('chained').className, 'btn own', 'generated and own class names are joined');
    assert.equal(find('chained').getAttribute('type'), 'button');
    assert.equal(find('auto').textContent, 'Add item', 'an empty child receives the title');
    assert.equal(
      find('auto').querySelector('svg[data-icon="plus"]').getAttribute('aria-hidden'),
      'true',
      'and the icon',
    );
    assert.equal(find('content').textContent, 'Custom', 'explicit content stays');
    assert.equal(find('content').querySelector('svg'), null);
    await click(find('prevented'));
    assert.deepEqual(calls, ['child', 'add:3'], 'a child that prevents default stops the action');
    assert.equal(find('child-disabled').disabled, true, 'a disabled child stays disabled');
    assert.equal(find('action-disabled').disabled, true, 'a disabled action disables the child');
    assert.equal(find('hidden'), null, 'hidden actions render nothing');
    assert.equal(find('unknown'), null, 'unregistered actions render nothing');
    assert.equal(
      find('render').textContent,
      'Add item:true',
      'render functions receive the control',
    );
    await click(find('render'));
    assert.deepEqual(calls, ['child', 'add:3', 'add:fn']);
    assert.equal(view.container.querySelector('[data-spinner]'), null);
    await click(find('slow'));
    assert.equal(find('slow').disabled, true);
    assert.ok(
      find('slow').querySelector('[data-spinner]'),
      'the pending node renders after the content while running',
    );
    assert.equal(find('slow').textContent, 'Go');
    await act(async () => gate.resolve());
    assert.equal(find('slow').disabled, false);
    assert.equal(view.container.querySelector('[data-spinner]'), null);
  } finally {
    await view.unmount();
  }
});

test('<Action> picks the control kind: links render through the router Link, toggles and choices use their own props', async () => {
  const visits = [];
  const Link = ({ href, children, ...props }) =>
    h('a', { ...props, href, 'data-router-link': true }, children);
  const Switch = ({ checked, onCheckedChange, disabled, ...props }) =>
    h('button', {
      ...props,
      role: 'switch',
      'aria-checked': checked,
      disabled,
      onClick: () => onCheckedChange(!checked),
    });
  const Select = ({ value, onValueChange, disabled, ...props }) =>
    h(
      'select',
      {
        ...props,
        value: value ?? '',
        disabled,
        onChange: (event) => onValueChange(event.target.value),
      },
      h('option', { value: 'light' }, 'Light'),
      h('option', { value: 'dark' }, 'Dark'),
    );
  const Item = ({ onSelect, disabled, variant, ...props }) =>
    h('li', {
      ...props,
      'data-variant': variant,
      'aria-disabled': disabled,
      onClick: () => onSelect(),
    });
  const picked = [];
  const config = {
    actions: {
      docs: defineAction({ title: 'Docs', icon: Icon, href: '/docs' }),
      site: defineAction({ title: 'Site', href: 'https://example.com/' }),
      locked: defineAction({ title: 'Locked', href: '/locked', enabled: false }),
      preview: defineAction({
        title: 'Preview',
        checked: false,
        execute: ({ input, update }) => update({ checked: input }),
      }),
      theme: defineAction({
        title: 'Theme',
        value: 'light',
        execute: ({ input, update }) => update({ value: input }),
      }),
      remove: defineAction({
        title: 'Remove',
        variant: 'destructive',
        execute: ({ input }) => picked.push(input),
      }),
    },
  };
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI, actionOptions: { navigate: (href) => visits.push(href), Link } },
      h(Action, { id: 'docs' }, h('a', { 'data-name': 'docs' })),
      h(Action, { id: 'site' }, h('a', { 'data-name': 'site' })),
      h(Action, { id: 'locked' }, h('a', { 'data-name': 'locked' })),
      h(Action, { id: 'docs', kind: 'button' }, h('button', { 'data-name': 'docs-button' })),
      h(Action, { id: 'preview', kind: 'toggle' }, h(Switch, { 'data-name': 'preview' })),
      h(Action, { id: 'theme', kind: 'choice' }, h(Select, { 'data-name': 'theme' })),
      h(
        Action,
        { id: 'remove', kind: 'menuItem', input: 'row-1' },
        h(Item, { 'data-name': 'remove' }, 'Remove'),
      ),
    ),
  );
  const find = (name) => view.container.querySelector(`[data-name="${name}"]`);
  try {
    assert.equal(find('docs').getAttribute('href'), '/docs');
    assert.equal(
      find('docs').dataset.routerLink,
      'true',
      'internal hrefs render with the router Link',
    );
    assert.equal(find('docs').textContent, 'Docs');
    assert.ok(find('docs').querySelector('svg[data-icon="plus"]'));
    await click(find('docs'));
    assert.deepEqual(visits, ['/docs']);
    assert.equal(find('site').dataset.routerLink, undefined, 'external hrefs stay plain anchors');
    assert.equal(find('site').getAttribute('href'), 'https://example.com/');
    assert.equal(
      find('locked').dataset.routerLink,
      undefined,
      'disabled links stay plain and inert',
    );
    assert.equal(find('locked').getAttribute('href'), null);
    assert.equal(find('locked').getAttribute('aria-disabled'), 'true');
    assert.equal(
      find('docs-button').getAttribute('type'),
      'button',
      'kind overrides the href default',
    );
    await click(find('docs-button'));
    assert.deepEqual(
      visits,
      ['/docs', '/docs'],
      'as a button the navigation action executes through the list',
    );
    assert.equal(find('preview').getAttribute('aria-checked'), 'false');
    await click(find('preview'));
    assert.equal(find('preview').getAttribute('aria-checked'), 'true');
    assert.equal(find('theme').value, 'light');
    await act(async () => {
      const select = find('theme');
      select.value = 'dark';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(find('theme').value, 'dark');
    assert.equal(find('remove').dataset.variant, 'destructive');
    await click(find('remove'));
    assert.deepEqual(picked, ['row-1']);
  } finally {
    await view.unmount();
  }
});

test('ActionButton and ActionLink are sugar over <Action> with custom components, inputs, hints and titles', async () => {
  const received = [];
  const gate = deferred();
  const config = {
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          add: defineAction({
            title: 'Add',
            description: 'Adds an item',
            tooltip: 'Add now',
            execute: ({ input }) => received.push(input),
          }),
          remove: defineAction({
            title: ({ input }) => (input ? `Remove ${input}` : 'Remove'),
            tooltip: ({ input }) => (input ? `Remove ${input} from the list` : undefined),
            checked: ({ input }) => input === 'Milk',
            execute: () => gate.promise,
          }),
          docs: defineAction({
            title: 'Docs',
            description: 'Opens the documentation',
            tooltip: 'Docs',
            href: '/docs',
          }),
        },
      }),
    ],
  };
  function CustomButton(props) {
    return h('button', { ...props, 'data-custom': true });
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI },
      h(ActionButton, { action: 'todos.add', as: CustomButton, input: 42 }),
      h(ActionButton, { action: 'todos.add', input: 8, title: 'Custom hint' }, 'Add another'),
      h(ActionButton, { action: 'todos.remove', input: 'Milk' }),
      h(ActionButton, { action: 'todos.remove' }),
      h(ActionLink, { action: 'todos.docs' }),
      h(ActionLink, { action: 'todos.docs', title: 'Custom link' }, 'Read'),
    ),
  );
  try {
    const buttons = [...view.container.querySelectorAll('button')];
    assert.equal(buttons.length, 4);
    assert.equal(buttons[0].dataset.custom, 'true', 'as renders the given component');
    assert.deepEqual(
      buttons.map((button) => button.textContent),
      ['Add', 'Add another', 'Remove Milk', 'Remove'],
      'the title follows the input; children override the content',
    );
    assert.deepEqual(
      buttons.map((button) => button.title),
      ['Add now', 'Custom hint', 'Remove Milk from the list', ''],
      'tooltips fall back per input and an explicit title wins',
    );
    assert.equal(
      buttons[2].getAttribute('aria-pressed'),
      'true',
      'presentation resolved for the input sets the pressed state',
    );
    await click(buttons[0]);
    assert.deepEqual(received, [42]);
    await click(buttons[2]);
    assert.equal(buttons[2].disabled, true);
    assert.equal(buttons[3].disabled, true, 'exclusive actions disable every button');
    await act(async () => gate.resolve());
    assert.equal(buttons[3].disabled, false);
    const links = [...view.container.querySelectorAll('a')];
    assert.deepEqual(
      links.map((link) => [link.getAttribute('href'), link.title, link.textContent]),
      [
        ['/docs', 'Docs', 'Docs'],
        ['/docs', 'Custom link', 'Read'],
      ],
    );
  } finally {
    await view.unmount();
  }
});

test('linkProps report a failing client navigation to onError instead of throwing from the click', async () => {
  const list = createActionList([{ id: 'docs', title: 'Docs', href: '/docs' }]);
  const view = await mount(
    h(
      ActionProvider,
      {
        actions: list,
        navigate: () => {
          throw new Error('router unavailable');
        },
      },
      h(Probe, { name: 'failing', id: 'docs' }),
    ),
  );
  try {
    const errors = [];
    const link = controls.failing.linkProps({ onError: (error) => errors.push(error.message) });
    link.onClick(fakeClick());
    assert.deepEqual(errors, ['router unavailable']);
  } finally {
    await view.unmount();
  }
});
