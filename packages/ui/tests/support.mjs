// Shared helpers for the React binding tests: a jsdom document, act-wrapped mounting and a
// minimal host UI that renders the dialog primitives as plain elements.
import { JSDOM } from 'jsdom';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

export function installDom(url = 'http://localhost/') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

/** Renders into a fresh container; `render` re-renders and `unmount` removes it, both inside act. */
export async function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    root,
    render: (next) => act(async () => root.render(next)),
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

export const click = (element) => act(async () => element.click());
export const tick = () => new Promise((resolve) => setTimeout(resolve));
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

/** Collects console.error output while `run` executes and restores the console afterwards. */
export async function silenced(run) {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    return { value: await run(), errors };
  } finally {
    console.error = original;
  }
}

const box = ({ children }) => h('div', null, children);
/** Host primitives as plain elements so dialog and menu output can be asserted on. */
export const testUI = {
  Dialog: ({ children }) => h('section', { role: 'dialog' }, children),
  DialogContent: ({ children, size, onCloseAutoFocus, ...props }) =>
    h('div', { 'data-size': size, ...props }, children),
  DialogHeader: box,
  DialogTitle: ({ children }) => h('h2', null, children),
  DialogDescription: ({ children, ...props }) => h('p', props, children),
  DialogFooter: box,
  Button: ({ children, variant, autoFocus, ...props }) =>
    h('button', { 'data-variant': variant, ...props }, children),
  Input: (props) => h('input', props),
  Field: box,
  FieldLabel: ({ children, ...props }) => h('label', props, children),
  FieldGroup: box,
  FieldError: box,
  Menu: ({ groups, label }) =>
    h(
      'nav',
      { 'aria-label': label },
      groups.map((group) =>
        h(
          'section',
          { key: group.id, 'data-group': group.id, 'aria-label': group.title },
          group.items.map((item) => h('button', { key: item.id, ...item.props() }, item.title)),
        ),
      ),
    ),
};
