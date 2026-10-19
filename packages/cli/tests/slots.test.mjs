import test from 'node:test';
import assert from 'node:assert/strict';
import { describeBitaKit } from '@bitakit/discovery';
import { describeSlots, formatSlots } from '../src/slots.mjs';
import { bitakit, project } from './helpers.mjs';

const slot = (options) =>
  `import { defineSlot } from '@bitakit/core';\nimport { z } from 'zod';\nexport default defineSlot(${options});\n`;
const action = (options) =>
  `import { defineAction } from '@bitakit/core';\nexport default defineAction(${options});\n`;

/** An app with local slots, an installed layout package with a slot sidecar and name hints. */
const app = () => ({
  'package.json': {
    name: 'demo',
    dependencies: { next: '16.0.0', '@example/frame': '1.0.0' },
  },
  'bitakit.config.ts':
    "export default { slots: ['config.hint'], plugins: { overrides: { off: { enabled: false } } } };\n",
  'node_modules/@example/frame/package.json': {
    name: '@example/frame',
    version: '1.0.0',
    bitakit: { plugin: './plugin', slots: ['frame.header', 'legacy.area'] },
  },
  'node_modules/@example/frame/plugin.js': 'export default () => ({ id: "frame" });\n',
  'node_modules/@example/frame/plugin.slots.json': {
    version: 1,
    definitions: [
      { id: 'frame.navigation', file: 'src/slots.ts', accepts: 'actions', plugin: 'frame' },
      { id: 'frame.header', file: 'src/slots.ts', accepts: 'component', plugin: 'frame' },
    ],
    unresolved: [],
  },
  'src/slots/banner.ts': slot("{ accepts: 'component', policy: 'single' }"),
  'src/plugins/todos/slots/footer.ts': slot("{ accepts: 'component' }"),
  'src/plugins/todos/slots/toolbar.ts': slot("{ accepts: 'actions' }"),
  'src/plugins/todos/slots/row.ts': slot(
    "{ accepts: 'actions', policy: 'keyed', payload: z.object({ todoId: z.string(), done: z.boolean() }) }",
  ),
  'src/plugins/todos/slots/menu.ts': `import { defineSlot } from '@bitakit/core';\nimport { rowPayload } from './-payload';\nexport default defineSlot({ accepts: 'actions', payload: rowPayload });\n`,
  'src/plugins/todos/slots/-payload.ts': 'export const rowPayload = { parse: (value) => value };\n',
  'src/plugins/todos/actions/open.ts': action(
    "{ title: 'Todos', href: '/todos', slots: ['frame.navigation'] }",
  ),
  'src/plugins/print/actions.ts': `import { defineAction } from '@bitakit/core';
const toolbar = { slot: 'todos.toolbar', input: () => undefined };
export default {
  list: defineAction({ title: 'Print', slots: [toolbar, 'frame.navigation', 'todos.sidebar'], execute() {} }),
  row: defineAction({ title: 'Print row', slots: [{ slot: 'todos.row', key: 'print', input: ({ payload }) => payload.todoId }], execute() {} }),
  plain: defineAction({ title: 'No placement', execute() {} }),
};
`,
  'src/plugins/dynamic/actions/place.ts': `import { defineAction } from '@bitakit/core';\nimport { targets } from './-targets';\nexport default defineAction({ title: 'Dynamic', slots: targets, execute() {} });\n`,
  'src/plugins/dynamic/actions/-targets.ts': "export const targets = ['todos.toolbar'];\n",
  'src/plugins/activity/ui/slots/todos.footer.tsx':
    'export default function Feed() { return null; }\n',
  'src/plugins/activity/ui/slots/frame/header.tsx':
    'export default function Badge() { return null; }\n',
  'src/plugins/activity/ui/slots/todos.footr.tsx':
    'export default function Typo() { return null; }\n',
  'src/plugins/off/ui/slots/todos.footer.tsx': 'export default function Off() { return null; }\n',
});

test('slots lists local and package contracts with owners, payloads and static contributions', async (t) => {
  const root = await project(app(), t);
  const result = await describeSlots(await describeBitaKit(root));
  assert.equal(result.version, 1);
  const byId = Object.fromEntries(result.slots.map((entry) => [entry.id, entry]));
  // Grouped as the listing prints them: the app, its plugins, packages, then name hints.
  assert.deepEqual(
    result.slots.map((entry) => entry.id),
    [
      'banner',
      'todos.footer',
      'todos.menu',
      'todos.row',
      'todos.toolbar',
      'frame.navigation',
      'frame.header',
      'legacy.area',
      'config.hint',
    ],
  );
  assert.deepEqual(byId.banner, {
    id: 'banner',
    owner: 'app',
    plugin: 'app',
    contract: true,
    accepts: 'component',
    policy: 'single',
    payload: false,
    payloadKeys: [],
    source: 'src/slots/banner.ts',
    contributions: [],
  });
  assert.deepEqual(
    [byId['todos.row'].policy, byId['todos.row'].payload, byId['todos.row'].payloadKeys],
    ['keyed', true, ['todoId', 'done']],
  );
  // An imported schema has a payload whose keys static inspection cannot know.
  assert.deepEqual([byId['todos.menu'].payload, byId['todos.menu'].payloadKeys], [true, null]);
  // A disabled plugin contributes nothing; the path names the target slot.
  assert.deepEqual(byId['todos.footer'].contributions, [
    {
      kind: 'component',
      id: null,
      plugin: 'activity',
      source: 'src/plugins/activity/ui/slots/todos.footer.tsx',
    },
  ]);
  assert.deepEqual(
    byId['todos.toolbar'].contributions.map((entry) => `${entry.kind} ${entry.id}`),
    ['action print.list'],
  );
  assert.deepEqual(
    byId['todos.row'].contributions.map((entry) => `${entry.kind} ${entry.id}`),
    ['action print.row'],
  );
  // Package contracts: owner is the package, payload is unknown, there is no local source.
  assert.deepEqual(
    {
      ...byId['frame.navigation'],
      contributions: byId['frame.navigation'].contributions.map((entry) => entry.id),
    },
    {
      id: 'frame.navigation',
      owner: '@example/frame',
      plugin: 'frame',
      contract: true,
      accepts: 'actions',
      policy: null,
      payload: null,
      payloadKeys: null,
      source: null,
      contributions: ['print.list', 'todos.open'],
    },
  );
  assert.deepEqual(byId['frame.header'].contributions, [
    {
      kind: 'component',
      id: null,
      plugin: 'activity',
      source: 'src/plugins/activity/ui/slots/frame/header.tsx',
    },
  ]);
  // Name hints from a package manifest or bitakit.config.ts have no contract to report.
  for (const id of ['legacy.area', 'config.hint'])
    assert.deepEqual(
      [byId[id].contract, byId[id].owner, byId[id].accepts, byId[id].policy],
      [false, null, null, null],
    );
  // Placements that are not literal are reported, never guessed.
  assert.deepEqual(result.unresolved, ['src/plugins/dynamic/actions/place.ts']);
  // Contributions to a slot nobody declares are listed, not dropped.
  assert.deepEqual(result.unknownTargets, [
    {
      slot: 'todos.footr',
      kind: 'component',
      id: null,
      plugin: 'activity',
      source: 'src/plugins/activity/ui/slots/todos.footr.tsx',
    },
    {
      slot: 'todos.sidebar',
      kind: 'action',
      id: 'print.list',
      plugin: 'print',
      source: 'src/plugins/print/actions.ts',
    },
  ]);
  assert.equal(JSON.stringify(result).includes(root), false);
});

test('bitakit slots prints one line per slot under its owner; --json prints the same data', async (t) => {
  const root = await project(app(), t);
  const json = await bitakit(root, 'slots', '--json');
  assert.equal(json.code, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), await describeSlots(await describeBitaKit(root)));
  const text = await bitakit(root, 'slots');
  assert.equal(text.code, 0, text.stderr);
  assert.match(
    text.stdout,
    /\nPlugin "app"\n  banner +component  0 contributions\n\nPlugin "todos"\n  todos\.footer +component  1 contribution\n/,
  );
  assert.match(
    text.stdout,
    /\nPackage "@example\/frame"\n  frame\.navigation +actions    2 contributions\n  frame\.header +component  1 contribution\n/,
  );
  assert.match(
    text.stdout,
    /\nName hints without a slot contract\n  legacy\.area +unknown    0 contributions\n/,
  );
  assert.match(
    text.stdout,
    /2 contributions to undeclared slots:\n  todos\.footr  component  src\/plugins\/activity\/ui\/slots\/todos\.footr\.tsx\n  todos\.sidebar  Action print\.list  src\/plugins\/print\/actions\.ts\n/,
  );
  assert.match(
    text.stdout,
    /1 file could not be read statically:\n  src\/plugins\/dynamic\/actions\/place\.ts/,
  );
});

test('an app without slots says so and still reports what it could not read', () => {
  assert.deepEqual(formatSlots({ version: 1, slots: [], unresolved: [], unknownTargets: [] }), [
    'No slots are declared.',
  ]);
  // An unreadable slot file must not look like an app without slots.
  assert.deepEqual(
    formatSlots({
      version: 1,
      slots: [],
      unresolved: ['src/plugins/notes/slots/toolbar.ts'],
      unknownTargets: [
        {
          slot: 'notes.toolbar',
          kind: 'component',
          id: null,
          plugin: 'notes',
          source: 'src/plugins/notes/ui/slots/notes.toolbar.tsx',
        },
      ],
    }),
    [
      'No slots are declared.',
      '',
      '1 contribution to undeclared slots:',
      '  notes.toolbar  component  src/plugins/notes/ui/slots/notes.toolbar.tsx',
      '',
      '1 file could not be read statically:',
      '  src/plugins/notes/slots/toolbar.ts',
    ],
  );
});
