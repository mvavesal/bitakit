import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act, useEffect, useState } from 'react';
import { installDom, mount, tick, testUI, deferred, click } from './support.mjs';
import {
  Action,
  BitaKitRuntimeProvider,
  PluginPage,
  PluginSlot,
  useBitaKit,
  useBitaKitReady,
  useRuntimeInventory,
  useService,
  useServiceState,
  useSlot,
  ActionButton,
} from '../dist/index.js';
import { definePlugin, defineService, defineAction, defineSlot } from '@bitakit/core';
installDom();

test('an explicit React host update preserves an independent store and refreshes slot controls and inventory', async () => {
  let runtime;
  const keeper = definePlugin({
    id: 'keeper',
    services: { counter: defineService(({ store }) => ({ state: store(7) })) },
  });
  const plugin = (title) =>
    definePlugin({
      id: 'page',
      actions: { command: defineAction({ title, slots: ['tools'], execute: () => title }) },
    });
  const initial = plugin('Before');
  function Demo() {
    runtime = useBitaKit().runtime;
    const inventory = useRuntimeInventory();
    const count = useServiceState('keeper.counter', (state) => state, 0);
    const slot = useSlot('tools');
    return h(
      'div',
      null,
      h('output', { 'data-count': true }, count),
      h('output', { 'data-revision': true }, inventory.live.revision),
      ...slot.items.map((item) => h(ActionButton, { key: item.key, action: item.action })),
    );
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config: {
          plugins: [keeper, initial],
          slots: { tools: defineSlot({ accepts: 'actions' }) },
        },
        ui: testUI,
        isolateFailures: false,
      },
      h(Demo),
    ),
  );
  try {
    await act(tick);
    const stable = runtime.services.keeper.counter;
    await act(() => stable.state.set(41));
    await act(async () =>
      assert.equal((await runtime.reconcilePlugins([keeper, plugin('After')])).status, 'applied'),
    );
    assert.equal(runtime.services.keeper.counter, stable);
    assert.equal(view.container.querySelector('[data-count]').textContent, '41');
    assert.equal(view.container.querySelector('[data-revision]').textContent, '1');
    assert.match(view.container.textContent, /After/);
    assert.doesNotMatch(view.container.textContent, /Before/);
  } finally {
    await view.unmount();
  }
});

test('targeted failure preserves healthy page, provider and widgets while affected services wait and recover', async () => {
  const stopEntered = deferred();
  const stopGate = deferred();
  const startEntered = deferred();
  const startGate = deferred();
  const instances = [];
  let providerMounts = 0;
  let providerUnmounts = 0;
  let pageMounts = 0;
  let pageUnmounts = 0;
  let keepCalls = 0;
  let runtime;

  const observable = (value) => {
    let current = { value };
    const listeners = new Set();
    const instance = {
      listeners,
      getSnapshot: () => current,
      set(next) {
        current = next;
        for (const listener of listeners) listener();
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    instances.push(instance);
    return instance;
  };

  function AlphaProvider({ children }) {
    useEffect(() => {
      providerMounts++;
      return () => providerUnmounts++;
    }, []);
    return h('div', { 'data-alpha-provider': true }, children);
  }
  function AlphaPage() {
    const [draft, setDraft] = useState('initial draft');
    const [local, setLocal] = useState(0);
    useEffect(() => {
      pageMounts++;
      return () => pageUnmounts++;
    }, []);
    const updateDraft = (event) => setDraft(event.target.value);
    return h(
      'section',
      { 'data-alpha-page': true },
      h('input', {
        'data-page-input': true,
        value: draft,
        onChange: updateDraft,
        onInput: updateDraft,
      }),
      h(
        'button',
        {
          type: 'button',
          'data-local-state': true,
          onClick: () => setLocal((value) => value + 1),
        },
        'Local state',
      ),
      h('output', { 'data-local-count': true }, local),
    );
  }
  function BetaPage() {
    return h('p', { 'data-beta-page': true }, 'Beta page ready');
  }
  function DeclaredWidget() {
    return h('span', { 'data-declared-widget': true }, 'Declared widget');
  }
  function BetaWidget() {
    return h('span', { 'data-beta-widget': true }, 'Beta widget');
  }
  function LegacyWidget() {
    return h('span', { 'data-legacy-widget': true }, 'Legacy widget');
  }
  const alpha = definePlugin({
    id: 'alpha',
    slots: { panel: defineSlot({ accepts: 'component' }) },
    actions: {
      keep: defineAction({
        title: 'Keep working',
        execute: () => {
          keepCalls++;
        },
      }),
    },
    ui: {
      pages: [{ path: '/alpha', component: AlphaPage }],
      providers: [{ id: 'frame', component: AlphaProvider }],
    },
  });
  const betaSlots = { panel: defineSlot({ accepts: 'component' }) };
  const makeBeta = (value, { delayedStop = false, delayedFailure = false } = {}) =>
    definePlugin({
      id: 'beta',
      slots: betaSlots,
      services: {
        value: defineService(
          ({ onStop, onStart }) => {
            const instance = observable(value);
            if (delayedStop)
              onStop(async () => {
                stopEntered.resolve();
                await stopGate.promise;
              });
            if (delayedFailure)
              onStart(async () => {
                startEntered.resolve();
                await startGate.promise;
                throw new Error('beta update rejected');
              });
            return instance;
          },
          { exposeAs: 'betaAlias' },
        ),
      },
      ui: { pages: [{ path: '/beta', component: BetaPage }] },
    });
  const initialBeta = makeBeta('initial', { delayedStop: true });
  const contributors = definePlugin({
    id: 'contributors',
    ui: {
      slots: [
        { slot: 'alpha.panel', component: DeclaredWidget },
        { slot: 'beta.panel', component: BetaWidget },
        { slot: 'legacy-panel', component: LegacyWidget },
      ],
    },
  });
  function Host() {
    runtime = useBitaKit().runtime;
    const globallyReady = useBitaKitReady();
    const betaReady = useBitaKitReady('beta');
    const betaService = useService('betaAlias');
    const betaValue = useServiceState('beta.value', (state) => state.value, 'unavailable');
    const aliasValue = useServiceState('betaAlias', (state) => state.value, 'unavailable');
    const alphaSlot = useSlot('alpha.panel');
    const betaSlotView = useSlot('beta.panel');
    return h(
      'main',
      null,
      h('output', { 'data-global-ready': true }, String(globallyReady)),
      h('output', { 'data-beta-ready': true }, String(betaReady)),
      h('output', { 'data-beta-service': true }, betaService?.getSnapshot().value ?? 'unavailable'),
      h('output', { 'data-beta-value': true }, betaValue),
      h('output', { 'data-alias-value': true }, aliasValue),
      h('output', { 'data-beta-has': true }, String(runtime.app.has('betaAlias'))),
      h(
        'output',
        { 'data-alpha-slot': true },
        [alphaSlot.phase, alphaSlot.pending, alphaSlot.items.length].join(':'),
      ),
      h(
        'output',
        { 'data-beta-slot': true },
        [betaSlotView.phase, betaSlotView.pending, betaSlotView.items.length].join(':'),
      ),
      h(PluginPage, {
        pathname: '/alpha',
        unavailable: h('output', { 'data-unavailable-alpha': true }, 'Alpha unavailable'),
      }),
      h(PluginPage, {
        pathname: '/beta',
        unavailable: h('output', { 'data-unavailable-beta': true }, 'Beta unavailable'),
      }),
      h(PluginSlot, { name: 'alpha.panel' }),
      h(PluginSlot, { name: 'beta.panel' }),
      h(PluginSlot, { name: 'legacy-panel' }),
      h(
        Action,
        { id: 'alpha.keep' },
        h(
          'button',
          {
            type: 'button',
            'data-keep-action': true,
          },
          'Keep working',
        ),
      ),
    );
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config: {
          plugins: [alpha, initialBeta, contributors],
        },
        ui: testUI,
        isolateFailures: false,
      },
      h(Host),
    ),
  );
  const text = (name) => view.container.querySelector('[data-' + name + ']')?.textContent;
  const previousActiveElement = Object.getOwnPropertyDescriptor(document, 'activeElement');
  let focusedElement;
  try {
    await act(tick);
    const initialService = instances[0];
    const initialListenerCount = initialService.listeners.size;
    assert.ok(initialListenerCount > 0);
    assert.equal(text('global-ready'), 'true');
    assert.equal(text('beta-ready'), 'true');
    assert.equal(text('beta-service'), 'initial');
    assert.equal(text('beta-value'), 'initial');
    assert.equal(text('alias-value'), 'initial');
    assert.equal(text('beta-has'), 'true');

    const input = view.container.querySelector('[data-page-input]');
    const setInput = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ).set;
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => focusedElement,
    });
    await act(async () => {
      setInput.call(input, 'draft while beta restarts');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      focusedElement = input;
      view.container.querySelector('[data-local-state]').click();
    });
    assert.equal(input.value, 'draft while beta restarts');
    assert.equal(document.activeElement, input);
    assert.equal(text('local-count'), '1');

    const stable = {
      provider: view.container.querySelector('[data-alpha-provider]'),
      page: view.container.querySelector('[data-alpha-page]'),
      input,
      declared: view.container.querySelector('[data-declared-widget]'),
      legacy: view.container.querySelector('[data-legacy-widget]'),
    };
    const brokenBeta = makeBeta('broken', { delayedStop: true, delayedFailure: true });
    let update;
    await act(async () => {
      update = runtime.reconcilePlugins([alpha, brokenBeta, contributors]);
      await tick();
    });
    await stopEntered.promise;
    await act(tick);
    assert.equal(text('global-ready'), 'true');
    assert.equal(text('beta-ready'), 'false');
    assert.equal(text('beta-service'), 'unavailable');
    assert.equal(text('beta-value'), 'unavailable');
    assert.equal(text('alias-value'), 'unavailable');
    assert.equal(text('beta-has'), 'false');
    assert.equal(text('beta-slot').split(':')[1], 'true');
    await click(view.container.querySelector('[data-keep-action]'));
    assert.equal(keepCalls, 1, 'an unaffected Action executes while cleanup is pending');

    await act(async () => {
      stopGate.resolve();
      await startEntered.promise;
      await tick();
    });
    assert.equal(text('global-ready'), 'true');
    assert.equal(text('beta-ready'), 'false');
    assert.equal(text('beta-service'), 'unavailable');
    assert.equal(input.value, 'draft while beta restarts');
    assert.equal(document.activeElement, input);
    assert.equal(text('local-count'), '1');

    await act(async () => {
      startGate.resolve();
      assert.equal((await update).status, 'failed');
      await tick();
    });
    assert.equal(text('global-ready'), 'true');
    assert.equal(text('beta-ready'), 'false');
    assert.equal(text('beta-service'), 'unavailable');
    assert.equal(text('beta-value'), 'unavailable');
    assert.equal(text('alias-value'), 'unavailable');
    assert.equal(text('beta-has'), 'false');
    assert.match(text('unavailable-beta'), /Beta unavailable/);
    assert.equal(
      text('beta-slot').split(':')[1],
      'false',
      'failed slot owners are not left pending',
    );
    assert.match(text('alpha-slot'), /false:1$/);
    assert.equal(view.container.querySelector('[data-beta-widget]'), null);
    assert.ok(view.container.querySelector('[data-legacy-widget]'));
    await click(view.container.querySelector('[data-keep-action]'));
    assert.equal(keepCalls, 2);
    assert.equal(initialService.listeners.size, 0, 'the replaced service releases old subscribers');
    assert.equal(view.container.querySelector('[data-alpha-provider]'), stable.provider);
    assert.equal(view.container.querySelector('[data-alpha-page]'), stable.page);
    assert.equal(view.container.querySelector('[data-page-input]'), stable.input);
    assert.equal(view.container.querySelector('[data-declared-widget]'), stable.declared);
    assert.equal(view.container.querySelector('[data-legacy-widget]'), stable.legacy);
    assert.equal(providerMounts, 1);
    assert.equal(providerUnmounts, 0);
    assert.equal(pageMounts, 1);
    assert.equal(pageUnmounts, 0);
    assert.equal(input.value, 'draft while beta restarts');
    assert.equal(document.activeElement, input);
    assert.equal(text('local-count'), '1');

    const recoveredBeta = makeBeta('recovered');
    await act(async () => {
      assert.equal(
        (await runtime.reconcilePlugins([alpha, recoveredBeta, contributors])).status,
        'applied',
      );
    });
    await act(tick);
    const recoveredService = instances.at(-1);
    assert.equal(text('global-ready'), 'true');
    assert.equal(text('beta-ready'), 'true');
    assert.equal(text('beta-service'), 'recovered');
    assert.equal(text('beta-value'), 'recovered');
    assert.equal(text('alias-value'), 'recovered');
    assert.equal(text('beta-has'), 'true');
    assert.match(text('beta-slot'), /false:1$/);
    assert.match(text('beta-page'), /Beta page ready/);
    assert.equal(recoveredService.listeners.size, initialListenerCount);
    await act(() => recoveredService.set({ value: 'updated' }));
    assert.equal(text('beta-value'), 'updated');
    assert.equal(text('alias-value'), 'updated');
    await act(() => initialService.set({ value: 'stale old service' }));
    assert.equal(text('beta-value'), 'updated', 'the old service no longer notifies the view');
    assert.equal(recoveredService.listeners.size, initialListenerCount);
    await click(view.container.querySelector('[data-keep-action]'));
    assert.equal(keepCalls, 3);
    assert.equal(view.container.querySelector('[data-alpha-provider]'), stable.provider);
    assert.equal(view.container.querySelector('[data-alpha-page]'), stable.page);
    assert.equal(view.container.querySelector('[data-page-input]'), stable.input);
    assert.equal(view.container.querySelector('[data-declared-widget]'), stable.declared);
    assert.equal(view.container.querySelector('[data-legacy-widget]'), stable.legacy);
    assert.equal(providerMounts, 1);
    assert.equal(pageMounts, 1);
  } finally {
    await view.unmount();
    if (previousActiveElement)
      Object.defineProperty(document, 'activeElement', previousActiveElement);
    else delete document.activeElement;
  }
  assert.equal(runtime.isReady(), false, 'full shutdown clears global readiness');
  assert.equal(providerUnmounts, 1);
  assert.equal(pageUnmounts, 1);
});

test('slot diagnostics explain contextual filtering without exposing outlet payload values', async () => {
  const secret = 'private-outlet-payload';
  const owner = definePlugin({
    id: 'diagnostic',
    slots: {
      widgets: defineSlot({
        accepts: 'component',
        payload: { parse: (value) => value },
      }),
    },
  });
  const contributions = definePlugin({
    id: 'widget-author',
    ui: {
      slots: [
        {
          slot: 'diagnostic.widgets',
          key: 'shown',
          when: ({ payload }) => payload.show,
          component: () => null,
        },
        {
          slot: 'diagnostic.widgets',
          key: 'hidden',
          when: ({ payload }) => payload.show,
          component: () => null,
        },
      ],
    },
  });
  let filtered, keyed;
  function Probe() {
    filtered = useSlot('diagnostic.widgets', { payload: { show: false, secret } });
    keyed = useSlot('diagnostic.widgets', { payload: { show: true, secret }, entryKey: 'shown' });
    return null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config: { plugins: [owner, contributions] },
        ui: testUI,
        isolateFailures: false,
      },
      h(Probe),
    ),
  );
  try {
    await act(tick);
    assert.equal(filtered.diagnostics.slot, 'diagnostic.widgets');
    assert.equal(filtered.diagnostics.owner, 'diagnostic');
    assert.equal(filtered.diagnostics.reason, 'filtered');
    assert.equal(filtered.diagnostics.attached, 2);
    assert.equal(filtered.diagnostics.selected, 0);
    assert.equal(filtered.diagnostics.rendered, null);
    assert.deepEqual(
      filtered.diagnostics.excluded.map((item) => item.reason),
      ['condition', 'condition'],
    );
    assert.equal(keyed.diagnostics.reason, 'ready');
    assert.equal(keyed.diagnostics.attached, 2);
    assert.equal(keyed.diagnostics.selected, 1);
    assert.deepEqual(
      keyed.diagnostics.excluded.map((item) => item.reason),
      ['key'],
    );
    assert.equal(JSON.stringify([filtered.diagnostics, keyed.diagnostics]).includes(secret), false);
    assert.equal(view.container.textContent, '');
  } finally {
    await view.unmount();
  }
});

test('structural activation preserves a draft while pages, slots and actions appear and disappear', async () => {
  let runtime;
  let mounts = 0;
  function Draft() {
    const [draft, setDraft] = useState('keep this draft');
    useEffect(() => {
      mounts++;
    }, []);
    return h('input', {
      'data-draft': true,
      value: draft,
      onInput: (event) => setDraft(event.target.value),
    });
  }
  function AddedPage() {
    return h('p', null, 'Notes page');
  }
  const notes = definePlugin({
    id: 'notes',
    actions: { add: defineAction({ title: 'Add note', slots: ['tools'], execute: () => {} }) },
    slots: { extra: defineSlot({ accepts: 'component' }) },
    ui: {
      pages: [{ path: '/notes', component: AddedPage }],
      slots: [{ slot: 'notes.extra', component: () => h('span', null, 'Notes widget') }],
    },
  });
  function Host() {
    runtime = useBitaKit().runtime;
    const tools = useSlot('tools');
    const extra = useSlot('notes.extra');
    return h(
      'main',
      null,
      h(Draft),
      ...tools.items.map((item) => h(ActionButton, { key: item.key, action: item.action })),
      h(PluginPage, { pathname: '/notes', fallback: h('p', null, 'No notes page') }),
      h('output', { 'data-extra': true }, extra.items.length),
      h(PluginSlot, { name: 'notes.extra' }),
    );
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config: { slots: { tools: defineSlot({ accepts: 'actions' }) } }, ui: testUI },
      h(Host),
    ),
  );
  try {
    await act(tick);
    const input = view.container.querySelector('[data-draft]');
    await act(async () => assert.equal((await runtime.plugins.add([notes])).status, 'applied'));
    assert.match(view.container.textContent, /Add note/);
    assert.match(view.container.textContent, /Notes page/);
    assert.match(view.container.textContent, /Notes widget/);
    await act(async () =>
      assert.equal(
        (await runtime.plugins.disable('notes', { dependents: 'refuse' })).status,
        'applied',
      ),
    );
    assert.doesNotMatch(view.container.textContent, /Add note|Notes page|Notes widget/);
    await act(async () => assert.equal((await runtime.plugins.enable('notes')).status, 'applied'));
    assert.match(view.container.textContent, /Add note|Notes page|Notes widget/);
    await act(async () =>
      assert.equal(
        (await runtime.plugins.remove(['notes'], { dependents: 'refuse' })).status,
        'applied',
      ),
    );
    assert.doesNotMatch(view.container.textContent, /Add note|Notes page|Notes widget/);
    assert.equal(view.container.querySelector('[data-extra]').textContent, '0');
    assert.equal(view.container.querySelector('[data-draft]'), input);
    assert.equal(input.value, 'keep this draft');
    assert.equal(mounts, 1);
  } finally {
    await view.unmount();
  }
});

test('useRuntimeInventory hydrates without a mismatch when the runtime started before the route hydrated', async () => {
  const { renderToString } = await import('react-dom/server');
  const { hydrateRoot } = await import('react-dom/client');
  const { createRuntime } = await import('@bitakit/core');
  // The internal context stands in for a provider whose runtime is already running.
  const { BitaKitContext } = await import('../dist/providers/foundation-context.js');
  const status = () => {
    const inventory = useRuntimeInventory();
    return h('output', null, inventory.live?.phase ?? 'unavailable');
  };
  const tree = (runtime) =>
    h(
      BitaKitContext.Provider,
      { value: { runtime, ui: testUI, labels: {}, notify() {} } },
      h(status),
    );
  // The server never starts the runtime.
  const html = renderToString(tree(createRuntime({ plugins: [] })));
  assert.equal(html, '<output>unavailable</output>');
  // A lazily hydrated route meets a client runtime that is already running.
  const runtime = createRuntime({ plugins: [] });
  const stop = runtime.mount();
  await runtime.ready;
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const errors = [];
  let root;
  await act(async () => {
    root = hydrateRoot(container, tree(runtime), {
      onRecoverableError: (error) => errors.push(error),
    });
  });
  assert.deepEqual(errors, []);
  assert.equal(container.textContent, 'ready', 'the live phase follows right after hydration');
  await act(async () => root.unmount());
  container.remove();
  await stop();
});
