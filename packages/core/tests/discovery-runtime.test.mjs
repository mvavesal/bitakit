import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionGroup,
  FoundationRuntime,
  NavigationHost,
  createActionList,
  createRuntime,
  defineAction,
  defineEvents,
  defineInterceptor,
  defineService,
  discoverActions,
  discoverEvents,
  discoverInterceptors,
  discoverServices,
  discoveredFile,
  event,
  isActionFailure,
  isFoundationStartupError,
  pluginPage,
  pluginSlot,
} from '../dist/core.js';

/** A discovered file at `src/<plugin>/<kind>/<name>.ts`, the way the generated file hands it over. */
const file = (value, localPath, source = `src/${localPath.replaceAll('.', '/')}.ts`) =>
  discoveredFile(value, localPath, source);

test('groups are inferred, shared across plugins, and dynamic API placements clean up', async () => {
  const list = createActionList();
  const typed = new ActionGroup('members.menu');
  let dynamic;
  const runtime = new FoundationRuntime(list, {
    plugins: [
      {
        id: 'one',
        actions: discoverActions([file(defineAction({ groups: ['menu', typed] }), 'run')], 'one'),
        setup({ app }) {
          dynamic = app.actions.getGroup('extra').attach('one.run');
        },
      },
      {
        id: 'two',
        actions: discoverActions([file(defineAction({ groups: ['menu'] }), 'run')], 'two'),
      },
    ],
  });
  const empty = runtime.getGroup('menu');
  const dispose = runtime.mount();
  assert.equal(runtime.getGroup('menu'), empty);
  assert.equal(runtime.getGroup('members.menu'), typed);
  assert.deepEqual(
    list.get('one.run').groups.map((group) => group.id),
    ['menu', 'members.menu', 'extra'],
  );
  assert.equal(list.get('one.run').groups[0], list.get('two.run').groups[0]);
  dynamic.dispose();
  assert.deepEqual(
    list.get('one.run').groups.map((group) => group.id),
    ['menu', 'members.menu'],
  );
  await dispose();
  assert.deepEqual(Object.keys(list.getState().actions), []);
  assert.throws(() => runtime.getGroup('invalid group'), /Invalid action group/);
});

test('discovered services form a tree; function-valued presentation follows their stores and titles follow the translator', async () => {
  const items = defineService(({ store }) => {
    const state = store({ items: [] });
    return {
      state,
      add: (title) => state.set((current) => ({ items: [...current.items, title] })),
      count: () => state.get().items.length,
    };
  });
  const runtime = createRuntime({
    plugins: [
      {
        id: 'todos',
        services: discoverServices([file(items, 'items')], 'todos'),
        actions: discoverActions(
          [
            file(
              defineAction({
                title: 'todos.add.title',
                execute: ({ services, input }) => services.todos.items.add(input),
              }),
              'add',
            ),
            file(
              defineAction({
                enabled: ({ services }) => services.todos.items.count() > 0,
                description: ({ services }) => `${services.todos.items.count()} items`,
                execute: ({ app }) => app.services.todos.items.count(),
              }),
              'clear',
            ),
          ],
          'todos',
        ),
      },
    ],
  });
  const catalog = { 'todos.add.title': 'Add item' };
  runtime.setTranslations(
    Object.assign((key) => catalog[key] ?? key, { has: (key) => Object.hasOwn(catalog, key) }),
  );
  assert.throws(() => runtime.app.services.todos, /not mounted/);
  const stop = runtime.mount();
  await runtime.ready;
  try {
    assert.equal(runtime.actions.get('todos.add').title, 'Add item');
    assert.equal(
      runtime.actions.get('todos.clear').title,
      'Clear',
      'the fallback title derives from the file name',
    );
    assert.equal(runtime.actions.get('todos.clear').enabled, false);
    assert.equal(runtime.actions.get('todos.clear').description, '0 items');
    assert.deepEqual(await runtime.actions.execute('todos.clear'), {
      status: 'skipped',
      reason: 'disabled',
    });
    await runtime.actions.execute('todos.add', 'Write tests');
    assert.equal(runtime.actions.get('todos.clear').enabled, true);
    assert.equal(runtime.actions.get('todos.clear').description, '1 items');
    assert.equal((await runtime.actions.execute('todos.clear')).value, 1);
    assert.equal(runtime.services.todos.items, runtime.app.services.todos.items);
    assert.equal(runtime.app.has('todos.items'), true);
    assert.throws(
      () => runtime.services['todos.items'],
      /Foundation service "todos\.items" is unavailable/,
    );
    assert.throws(
      () => runtime.services.todos.missing,
      /Foundation service "todos\.missing" is unavailable/,
    );
    runtime.setTranslations(Object.assign((key) => `de:${key}`, { has: () => true }));
    assert.equal(
      runtime.actions.get('todos.add').title,
      'de:todos.add.title',
      'translation updates re-title without re-registering',
    );
    assert.equal(
      runtime.actions.get('todos.clear').enabled,
      true,
      'state survives the translation update',
    );
  } finally {
    await stop();
  }
  assert.throws(() => runtime.services, /not mounted/);
});

test('href actions render the current href and navigate to the latest value when executed', async () => {
  const host = new NavigationHost();
  const urls = [];
  const release = host.bind((url) => urls.push(url));
  const list = createActionList([], { environment: host });
  const route = defineService(({ store }) => ({ state: store({ id: 1 }) }));
  const runtime = new FoundationRuntime(list, {
    plugins: [
      {
        id: 'navigation',
        services: discoverServices([file(route, 'route')], 'navigation'),
        actions: discoverActions(
          [
            file(defineAction({ href: '/first', groups: ['navigation'] }), 'home'),
            file(
              defineAction({
                href: ({ services }) => `/notes/${services.navigation.route.state.get().id}`,
              }),
              'current',
            ),
          ],
          'navigation',
        ),
      },
    ],
  });
  const dispose = runtime.mount();
  try {
    assert.equal(list.get('navigation.home').href, '/first');
    assert.equal(list.get('navigation.current').href, '/notes/1');
    list.update('navigation.home', { href: '/second' });
    await list.execute('navigation.home');
    runtime.services.navigation.route.state.set({ id: 2 });
    assert.equal(list.get('navigation.current').href, '/notes/2', 'dynamic hrefs follow the store');
    await list.execute('navigation.current');
    assert.deepEqual(urls, ['/second', '/notes/2']);
    assert.deepEqual(runtime.destinationOf(list.get('navigation.home')), {
      kind: 'page',
      plugin: 'navigation',
    });
  } finally {
    await dispose();
    release();
  }
  assert.throws(
    () =>
      new FoundationRuntime(createActionList(), {
        plugins: [
          {
            id: 'nav',
            actions: discoverActions(
              [
                file(
                  defineAction({ href: 'javascript:alert(1)' }),
                  'bad',
                  'src/plugins/nav/actions/bad.ts',
                ),
              ],
              'nav',
            ),
          },
        ],
      }).mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'nav');
      assert.equal(error.source, 'src/plugins/nav/actions/bad.ts');
      assert.match(
        error.message,
        /Action "nav\.bad" in plugin "nav" failed to start: .*invalid navigation target/,
      );
      return true;
    },
  );
});

test('discovered interceptors run in order, cancel safely, and clean up without touching host hooks', async () => {
  const log = [];
  const list = createActionList();
  list.use({
    before() {
      log.push('host');
    },
  });
  const runtime = new FoundationRuntime(list, {
    services: discoverServices([
      file(
        defineService(() => ({ ask: () => true })),
        'confirm',
      ),
    ]),
    interceptors: discoverInterceptors([
      file(
        defineInterceptor({
          order: 2,
          requires: ['confirm'],
          before: ({ services }) => {
            log.push('second');
            return services.confirm.ask() ? false : undefined;
          },
        }),
        'second',
      ),
      file(defineInterceptor({ order: 1, before: () => void log.push('first') }), 'first'),
      // A plain object is normalized; without an order it runs at 0, before the ordered ones.
      file({ before: () => void log.push('plain') }, 'plain'),
    ]),
    plugins: [
      {
        id: 'demo',
        actions: discoverActions(
          [file(defineAction({ execute: () => void log.push('execute') }), 'run')],
          'demo',
        ),
      },
    ],
  });
  const dispose = runtime.mount();
  assert.equal((await list.execute('demo.run')).reason, 'intercepted');
  assert.deepEqual(log, ['host', 'plain', 'first', 'second']);
  await dispose();
  log.length = 0;
  list.register({ id: 'later', title: 'Later', execute: () => void log.push('execute') });
  await list.execute('later');
  assert.deepEqual(
    log,
    ['host', 'execute'],
    'plugin interceptors are removed with the runtime; host hooks stay',
  );
});

test('plugin interceptors are scoped to their plugin unless global; after and onError observe outcomes', async () => {
  const seen = [];
  const runtime = createRuntime({
    plugins: [
      {
        id: 'todos',
        actions: discoverActions(
          [
            file(defineAction({ execute: () => 'done' }), 'add'),
            file(
              defineAction({
                execute: () => {
                  throw new Error('boom');
                },
              }),
              'fail',
            ),
          ],
          'todos',
        ),
        interceptors: discoverInterceptors([
          file(
            defineInterceptor({
              before: ({ id }) => void seen.push(`before ${id}`),
              after: ({ id, result }) => void seen.push(`after ${id} ${result}`),
              onError: ({ id, error }) => void seen.push(`error ${id} ${error.message}`),
            }),
            'audit',
          ),
          file(
            defineInterceptor({
              action: '*',
              scope: 'global',
              before: ({ id }) => void seen.push(`global ${id}`),
            }),
            'global',
          ),
        ]),
      },
      {
        id: 'other',
        actions: discoverActions([file(defineAction({ execute: () => 'other' }), 'run')], 'other'),
      },
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal((await runtime.actions.execute('todos.add')).value, 'done');
    assert.equal((await runtime.actions.execute('other.run')).value, 'other');
    await assert.rejects(
      runtime.actions.execute('todos.fail'),
      (error) => isActionFailure(error) && error.cause.message === 'boom',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(seen, [
      'before todos.add',
      'global todos.add',
      'after todos.add done',
      'global other.run',
      'before todos.fail',
      'global todos.fail',
      'error todos.fail boom',
    ]);
  } finally {
    await stop();
  }
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          {
            id: 'todos',
            interceptors: discoverInterceptors([
              file(
                defineInterceptor({ requires: ['billing.invoices'], before: () => {} }),
                'audit',
                'src/plugins/todos/interceptors/audit.ts',
              ),
            ]),
          },
        ],
      }).mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'todos');
      assert.match(
        error.message,
        /An interceptor in plugin "todos" requires service "billing\.invoices", but no service has that name/,
      );
      return true;
    },
  );
});

test('action overrides from the configuration cap presentation and are never bypassed by updates', async () => {
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    actionOverrides: {
      'demo.plain': { enabled: false },
      'demo.dynamic': { enabled: false },
      'demo.hidden': { visible: false },
    },
    plugins: [
      {
        id: 'demo',
        actions: discoverActions(
          [
            file(defineAction({ execute: () => assert.fail('Disabled action executed') }), 'plain'),
            file(
              defineAction({
                enabled: () => true,
                execute: () => assert.fail('Disabled action executed'),
              }),
              'dynamic',
            ),
            file(defineAction({ execute: () => assert.fail('Hidden action executed') }), 'hidden'),
          ],
          'demo',
        ),
      },
    ],
  });
  const dispose = runtime.mount();
  try {
    assert.equal(list.resolve('demo.dynamic').enabled, false);
    assert.equal((await list.execute('demo.dynamic')).reason, 'disabled');
    assert.equal((await list.execute('demo.plain')).reason, 'disabled');
    list.update('demo.plain', { enabled: true });
    assert.equal(list.get('demo.plain').enabled, false);
    list.update('demo.hidden', { visible: true });
    assert.equal(list.resolve('demo.hidden').visible, false);
    assert.equal((await list.execute('demo.hidden')).reason, 'hidden');
  } finally {
    await dispose();
  }
});

test('startup errors name the plugin and the discovered source file; events stay with their declaring plugin', async () => {
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          {
            id: 'todos',
            services: discoverServices(
              [
                file(
                  defineService(() => ({})),
                  'items',
                  'src/plugins/todos/services/items.ts',
                ),
              ],
              'todos',
            ),
            actions: discoverActions(
              [
                file(
                  defineAction({ requires: ['billing.invoices'], execute: () => {} }),
                  'add',
                  'src/plugins/todos/actions/add.ts',
                ),
              ],
              'todos',
            ),
          },
        ],
      }).mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'todos');
      assert.equal(error.app, false);
      assert.equal(error.source, 'src/plugins/todos/actions/add.ts');
      assert.match(
        error.message,
        /Action "todos\.add" requires service "billing\.invoices", but no service has that name\./,
      );
      assert.match(error.message, /Available services: todos\.items\./);
      assert.match(error.message, /Source: src\/plugins\/todos\/actions\/add\.ts/);
      return true;
    },
  );
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          {
            id: 'todos',
            services: discoverServices(
              [
                file(
                  defineService(() => {
                    throw new Error('database offline');
                  }),
                  'items',
                  'src/plugins/todos/services/items.ts',
                ),
              ],
              'todos',
            ),
          },
        ],
      }).mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'todos');
      assert.equal(error.source, 'src/plugins/todos/services/items.ts');
      assert.match(
        error.message,
        /Service "todos\.items" in plugin "todos" failed to start: database offline/,
      );
      return true;
    },
  );
  const notesEvents = discoverEvents([
    file(defineEvents({ changed: event() }), '', 'src/plugins/notes/events.ts'),
  ]);
  assert.equal(discoverEvents([]), undefined);
  assert.throws(
    () => discoverEvents([file({}, '', 'src/plugins/notes/events.ts')]),
    /src\/plugins\/notes\/events\.ts must default-export defineEvents/,
  );
  const runtime = createRuntime({
    plugins: [
      {
        id: 'notes',
        events: notesEvents,
        actions: discoverActions(
          [file(defineAction({ execute: ({ events }) => events.emit('notes.changed') }), 'touch')],
          'notes',
        ),
      },
      {
        id: 'other',
        actions: discoverActions(
          [file(defineAction({ execute: ({ events }) => events.emit('notes.changed') }), 'touch')],
          'other',
        ),
      },
    ],
  });
  const stop = runtime.mount();
  try {
    const received = [];
    runtime.events.on('notes.changed', (received_) => received.push(received_.type));
    assert.equal((await runtime.actions.execute('notes.touch')).status, 'completed');
    await assert.rejects(runtime.actions.execute('other.touch'), (error) => {
      assert.ok(isActionFailure(error));
      assert.match(
        error.cause.message,
        /"other" cannot emit "notes\.changed": that event belongs to plugin "notes"/,
      );
      return true;
    });
    assert.deepEqual(received, ['notes.changed']);
  } finally {
    await stop();
  }
});

test('an input schema disables the action for invalid input and validates before execute', async () => {
  const schema = {
    parse(value) {
      if (typeof value !== 'string' || !value.trim()) throw new Error('title required');
      return value.trim();
    },
  };
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    plugins: [
      {
        id: 'todos',
        actions: discoverActions(
          [
            file(defineAction({ input: schema, execute: ({ input }) => input }), 'add'),
            file(
              defineAction({ input: schema, enabled: true, execute: ({ input }) => input }),
              'force',
            ),
          ],
          'todos',
        ),
      },
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(list.resolve('todos.add', '   ').enabled, false);
    assert.equal(list.resolve('todos.add', 'ok').enabled, true);
    assert.deepEqual(await list.execute('todos.add', '   '), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.equal((await list.execute('todos.add', '  trimmed ')).value, 'trimmed');
    await assert.rejects(
      list.execute('todos.force', ''),
      (error) => isActionFailure(error) && error.cause.message === 'title required',
    );
  } finally {
    await stop();
  }
});
