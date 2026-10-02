import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Action,
  URLAction,
  createActionList,
  ActionProvider,
  ActionButton,
  ActionCheckbox,
  ActionRadioGroup,
  ActionBinding,
  ActionLink,
} from '../dist/actions/index.js';
const dom = new JSDOM('<html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function mount(element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return {
    host,
    async close() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

test('custom buttons share inherited state, invocation input, pending, visibility and errors', async () => {
  let finish;
  const inputs = [];
  const errors = [];
  class Save extends Action {
    async execute(input) {
      inputs.push(input);
      await new Promise((resolve) => (finish = resolve));
    }
  }
  const save = new Save({ title: 'Save', description: 'Save document' });
  const list = createActionList();
  list.add('save', save);
  function CustomButton(props) {
    return h('button', { ...props, 'data-custom': true });
  }
  const view = await mount(
    h(
      ActionProvider,
      { actions: list, onError: (e) => errors.push(e.message) },
      h(ActionButton, { action: 'save', as: CustomButton, input: 42 }),
      h(ActionButton, { action: 'save', input: 8 }),
    ),
  );
  try {
    await act(async () => {
      save.enabled = false;
    });
    assert.ok([...view.host.querySelectorAll('button')].every((button) => button.disabled));
    await act(async () => {
      save.enabled = true;
    });
    await act(async () => view.host.querySelector('button').click());
    assert.deepEqual(inputs, [42]);
    assert.ok([...view.host.querySelectorAll('button')].every((button) => button.disabled));
    await act(async () => {
      finish();
    });
    await act(async () => {
      save.title = 'Publish';
      save.visible = false;
    });
    assert.equal(view.host.querySelectorAll('button').length, 0);
    await act(async () => {
      save.visible = true;
    });
    assert.equal(view.host.querySelector('button').textContent, 'Publish');
    save.execute = () => {
      throw new Error('Cannot save');
    };
    await act(async () => view.host.querySelector('button').click());
    assert.deepEqual(errors, ['Cannot save']);
    assert.equal(list.get('save').pending, false);
  } finally {
    await view.close();
  }
});

test('checkboxes, radios and custom cards reflect the same action and confirmed values', async () => {
  class Toggle extends Action {
    execute(value) {
      this.checked = value;
    }
  }
  class Choose extends Action {
    execute(value) {
      if (value === 'bad') throw new Error('bad');
      this.value = value;
    }
  }
  const toggle = new Toggle({ title: 'Preview', checked: false });
  const choose = new Choose({ title: 'Theme', value: 'light' });
  const list = createActionList();
  list.add('toggle', toggle);
  list.add('theme', choose);
  const view = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(ActionCheckbox, { action: 'toggle' }),
      h(ActionRadioGroup, {
        action: 'theme',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
      }),
      h(ActionBinding, { action: 'theme', kind: 'choice', input: 'dark' }, (b) =>
        h(
          'button',
          { 'aria-pressed': b.selected, disabled: b.disabled, onClick: () => b.execute() },
          'Card',
        ),
      ),
    ),
  );
  try {
    await act(async () => view.host.querySelector('[type=checkbox]').click());
    assert.equal(toggle.checked, true);
    await act(async () => view.host.querySelector('button').click());
    assert.equal(view.host.querySelector('[value=dark]').checked, true);
    assert.equal(view.host.querySelector('button').getAttribute('aria-pressed'), 'true');
    await act(async () => {
      choose.value = 'light';
    });
    assert.equal(view.host.querySelector('[value=light]').checked, true);
    assert.equal(view.host.querySelector('button').getAttribute('aria-pressed'), 'false');
    await act(async () => {
      await assert.rejects(list.execute('theme', 'bad'));
    });
    assert.equal(choose.value, 'light');
  } finally {
    await view.close();
  }
});

test('URLAction uses the current URL and the provider navigation adapter', async () => {
  const visits = [];
  const url = new URLAction('/first');
  const list = createActionList();
  const registration = list.add('open', url);
  const view = await mount(
    h(
      ActionProvider,
      { actions: list, navigate: (href) => visits.push(href) },
      h(ActionButton, { action: 'open' }),
    ),
  );
  try {
    await act(async () => {
      url.href = '/second';
      view.host.querySelector('button').click();
    });
    assert.deepEqual(visits, ['/second']);
    await act(async () => registration.unregister());
    assert.equal(view.host.querySelector('button'), null);
    url.title = 'Removed';
    assert.equal(list.get('open'), undefined);
  } finally {
    await view.close();
  }
});

test('navigation and command actions inherit reactive state and accept ordinary execution input', async () => {
  const received = [];
  const drawer = new URLAction({ title: 'Open', href: '/first' });
  const menu = new Action({ title: 'Send', execute: (input) => received.push(input) });
  const list = createActionList();
  list.add('drawer', drawer);
  list.add('menu', menu);
  const visits = [];
  const view = await mount(
    h(
      ActionProvider,
      { actions: list, navigate: (href) => visits.push(href) },
      h(ActionButton, { action: 'drawer' }),
      h(ActionButton, { action: 'menu', input: 'message' }),
    ),
  );
  try {
    await act(async () => {
      drawer.title = 'Updated';
      drawer.href = '/second';
      menu.enabled = false;
    });
    assert.equal(view.host.querySelectorAll('button')[0].textContent, 'Updated');
    assert.equal(view.host.querySelectorAll('button')[1].disabled, true);
    await act(async () => view.host.querySelectorAll('button')[0].click());
    assert.deepEqual(visits, ['/second']);
    await act(async () => {
      menu.enabled = true;
    });
    await act(async () => view.host.querySelectorAll('button')[1].click());
    assert.deepEqual(received, ['message']);
  } finally {
    await view.close();
  }
});

test('buttons and links show the tooltip on hover, fall back to the description and keep an explicit title', async () => {
  const list = createActionList([
    { id: 'hint', title: 'Hint', description: 'Long explanation', tooltip: 'Short hint' },
    { id: 'plain', title: 'Plain', description: 'Only a description' },
    {
      id: 'row',
      title: 'Row',
      description: 'Row action',
      resolve: (input) => ({ tooltip: input ? `Remove ${input}` : undefined, checked: input === 'Milk' }),
    },
    { id: 'docs', title: 'Docs', description: 'Opens the documentation', tooltip: 'Docs', href: '/docs' },
  ]);
  const view = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(ActionButton, { action: 'hint' }),
      h(ActionButton, { action: 'plain' }),
      h(ActionButton, { action: 'row', input: 'Milk' }),
      h(ActionButton, { action: 'hint', title: 'Custom' }),
      h(ActionLink, { action: 'docs' }),
      h(ActionLink, { action: 'docs', title: 'Custom link' }),
    ),
  );
  try {
    const buttons = [...view.host.querySelectorAll('button')];
    assert.deepEqual(
      buttons.map((button) => button.title),
      ['Short hint', 'Only a description', 'Remove Milk', 'Custom'],
    );
    // Presentation resolved for the button's own input also sets the pressed state.
    assert.equal(buttons[2].getAttribute('aria-pressed'), 'true');
    assert.deepEqual(
      [...view.host.querySelectorAll('a')].map((link) => link.title),
      ['Docs', 'Custom link'],
    );
  } finally {
    await view.close();
  }
});
