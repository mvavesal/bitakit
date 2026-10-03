# Target API (0.2)

The shape every plugin, app and package uses after the refactor. One documented way per
concept. See [refactor-phases.md](../refactor-phases.md) for sequencing and
[dx-review.md](dx-review.md) for the reasons.

## Vocabulary

- **Plugin**: a folder under `src/plugins/<id>/` (or an npm package). The folder name is the ID.
- **Service**: behavior and state. ID `<plugin>.<file>`, reached as `services.<plugin>.<file>`.
- **Action**: an operation with presentation (title, enabled, pending). ID `<plugin>.<file>`.
- **Event**: a typed notification. Name `<plugin>.<name>`, declared once in `events.ts`.
- **Config**: build-time, immutable developer input.
- **Setting**: a user, organization or device value. Key `<plugin>.<name>`, declared once in
  `settings.ts`; the runtime owns the value, a storage contract persists it.
- **Interceptor**: observes or gates actions, or observes service methods.
- **Contract**: a typed service key any plugin may provide (`auth`, `i18n`, `email`).
- **UI**: everything under `ui/`: pages, slots, dialogs, providers. React only.

`define*` describes behavior that runs anywhere. A component is UI and never needs `define*`.

## Folder

```text
src/plugins/todos/
├── services/items.ts         defineService   → services.todos.items
├── actions/add.ts            defineAction    → todos.add
├── events.ts                 defineEvents    → todos.changed
├── settings.ts               defineSettings  → settings.todos.pageSize
├── configs/limits.ts         defineConfig    → app.config.todos.limits
├── interceptors/audit.ts     defineInterceptor
├── setup.ts                  plugin setup (optional)
├── plugin.config.ts          only for dependencies and metadata (optional)
├── locales/en.json           { "todos": { ... } }
└── ui/
    ├── pages/index.tsx       /todos          (filename = path)
    ├── pages/tasks/[id].tsx  /todos/tasks/:id
    ├── slots/app-bar.end.tsx component placed in slot "app-bar.end"
    ├── dialogs/rename.tsx    dialog opened by an action
    ├── settings/page.tsx     replaces the generated settings page of the plugin
    └── providers/query.tsx   React provider wrapped around the app
src/layouts/admin.tsx         app layout; a page opts in with `export const layout = 'admin'`
```

Folders only. `actions/x.ts` is the one spelling; `actions.x.ts` and `x.action.ts` are
migrated by `bitakit migrate`. Files need a default export; skipped files are reported.
Anything under `server/` is reserved and never bundled for the client.

## Service

```ts
import { defineService } from '@bitakit/core';

export default defineService(
  ({ services, config, events, store, onStart, onStop }) => {
    const state = store<{ items: Item[] }>({ items: [] }); // observable, typed once
    onStart(async ({ signal }) => {
      /* awaited before app.ready */
    });
    onStop(() => {
      /* cleanup */
    });
    return {
      state,
      add(title: string) {
        state.set((s) => ({ items: [...s.items, { id: Date.now(), title }] }));
        events.emit('todos.changed', { kind: 'added' }); // typed, owner-only
      },
    };
  },
  { requires: ['billing.invoices'], provides: authContract, exposeAs: 'items' },
);
```

- The factory receives one context object. Options are optional.
- `requires` is an optional startup check; a missing service fails lazily with a named error
  either way. `provides` registers the instance under a contract key; the instance must satisfy
  the contract. A key created as `serviceKey<T, 'notifications'>('notifications')` carries its
  literal name, so `services.notifications` is typed wherever the plugin is installed.
  `exposeAs` adds an alias in `services` (for deliberate flattening only).
- Anything a service exposes with `subscribe(listener)` is observed; `store()` is the
  built-in way to get that.

## Action

```ts
import { defineAction } from '@bitakit/core';
import { z } from 'zod';

export default defineAction({
  title: 'Add item', // literal or translation key; `<id>.title` key wins when present
  input: z.string().min(1), // optional schema: validates and types `input`
  enabled: ({ input }) => input.trim().length > 0, // value or function; functions re-run on service changes
  visible: ({ services }) => services.todos.items.state.get().items.length < 100,
  groups: ['todos.toolbar'],
  shortcut: { keys: 'Mod+Enter' },
  concurrency: 'per-input', // 'exclusive' (default) | 'per-input' | 'latest'
  confirm: ({ input }) => ({ title: 'Add this item?' }),
  execute: ({ services, input, signal }) => services.todos.items.add(input),
  success: ({ result }) => 'Item added', // string | key | function | false; `<id>.success` key by convention
  failure: ({ error }) => undefined, // undefined falls back to the default toast
});
```

- Navigation: `defineAction({ title: 'Todos', href: '/todos', groups: ['navigation'] })`.
- Dialog: `defineAction({ title: 'Rename', dialog: RenameDialog })` or
  `dialog: { component: RenameDialog, kind: 'sheet', size: 'wide' }`; the component receives
  `{ input, close, services }`. The action names a frame `kind`; the host registers frames on
  `FoundationProvider` (`dialogs={{ sheet: SheetFrame }}`) and decides the appearance.
  `dialogSize` is deprecated.
- Presentation fields that accept a function: `title`, `description`, `tooltip`, `enabled`,
  `visible`, `checked`, `value`, `variant`, `href`. The function context is
  `{ input, services, config, settings, app }`. `icon` is static, because a component cannot
  be told apart from a presentation function.
- `execute` context: `{ input, services, config, settings, app, events, signal, id, get, update }`.
  Sync or async. Pending is set only when a promise is returned.
- Without a schema, type the input explicitly: `defineAction<string>({ ... })` (result is
  then `unknown`). With a schema, input and result are inferred.
- Removed: `resolve`, `watch`, `events`/`onEvent`, `setup`, `initialState`, `state`,
  `dependsOn`, `conventions`, `configPath`, `unavailable`, `replaces`, the curried builder,
  class and factory exports, `defineURLAction`, `defineDialogAction`, `defineFormAction`.

## Events

```ts
// events.ts
import { defineEvents, event } from '@bitakit/core';

export default defineEvents({
  changed: event<{ kind: 'added' | 'removed' }>(),
  deleting: event<{ id: number }>({ cancelable: true }),
});

events.emit('todos.changed', { kind: 'added' });            // void
const allowed = await events.emit('todos.deleting', { id });  // Promise<boolean>
events.on('todos.changed', ({ data }) => ...);              // typed, auto-released
events.on('todos.*', ({ type, data }) => ...);
```

Full names everywhere. Only the declaring plugin may emit its events. Delivery is
synchronous, async handlers are awaited only for error reporting, errors are attributed.

## Config

```ts
export default defineConfig({
  schema: z.object({ maxItems: z.number() }),
  defaults: { maxItems: 100 },
});

app.config.todos.limits.maxItems; // typed
config.plugin.get('limits.maxItems', 100); // in contexts, typed by the fallback
config.action.get('defaultTitle', 'Untitled'); // configs/actions/<action>.ts
```

Overrides: `bitakit.config.ts` → `configOverrides: { todos: { limits: { maxItems: 50 } } }`.

## Settings

```ts
// src/plugins/todos/settings.ts — isomorphic, no React
export default defineSettings(
  {
    pageSize: setting({ schema: z.number().int().min(5).max(100), default: 20 }),
    theme: setting({ default: 'system', options: [{ value: 'light' }, { value: 'dark' }, { value: 'system' }], control: 'cards' }),
    compact: setting({ default: false, scope: 'device', label: 'Compact rows' }),
  },
  { title: 'Todos', category: 'general', order: 5 }, // section of the generated settings page
);

settings.todos.pageSize.get(); // in services, actions, interceptors, app.settings
await settings.todos.pageSize.set(50); // 'saved' | 'superseded' | 'cancelled'
settings.todos.pageSize.subscribe(listener);
const { value, ready, writable, pending, error, set, reset } = useSetting('todos.pageSize');
```

- Keys are `<plugin>.<name>`; app settings keep the plain name (`settings.theme`). Types come
  from the schema, the option values or the default, and land in the generated `SettingsMap`.
- `scope`: `user` (default), `organization` or `device`. The runtime follows the `auth`
  contract (`user.id`, `organizationId`) and reloads values when the identity changes.
- Persistence is the `settings.storage` contract: browser storage by default; a host provides
  a server-backed service in one file: `defineService(() => ({ load, save, loadMany?, reset? }), { provides: settingsStorage })`.
  Storage receives `{ scope, userId, organizationId }` and returns `{ value, writable }`.
- Every plugin with settings gets a generated page under `/settings/<plugin>` (fields by
  `control`, inferred from the value when omitted); `ui/settings/page.tsx` replaces it.
  Translation keys: `<plugin>.settings.<name>.label|description`, `<plugin>.settings.<name>.options.<value>.label|description`,
  `<plugin>.settings.title|description`.
- Presentation re-evaluates on setting changes like on store changes. Values are confirmed
  values: a failed write keeps the previous value and reports `error`.

## Interceptor

```ts
export default defineInterceptor({
  action: 'todos.*', // or ['todos.add'], '*' with scope: 'global'
  order: 10,
  before: ({ id, input, services }) => false, // false cancels
  after: ({ id, result }) => {},
  onError: ({ id, error }) => {},
});

export default defineInterceptor({ service: 'todos.items', method: 'add', before, after, onError });
```

`action` and `service` are mutually exclusive. Service hooks observe only. Arrays of
interceptors are allowed as a default export.

## Plugin (manual composition and packages)

```ts
export default definePlugin({
  id: 'todos',
  dependencies: ['shell'],
  services: { items: itemsService },             // records keyed by name; IDs become todos.items
  actions: { add: addAction },
  events: todosEvents,
  config: { limits },                            // a record: the schema lands at app.config.todos.limits
  settings: todosSettings,
  interceptors: [audit],
  setup: ({ app, services }) => () => {},
  ui: { pages: [...], slots: [...], providers: [...], settings: { component: TodosSettingsPage } },
});
```

Package plugins take no host objects: a host provides them as services under a contract
(`src/services/better-auth-client.ts` → `defineService(() => ({ client }), { provides: betterAuthClient })`,
`organization-backend` for organizations) and configures them in `configs/<name>.ts`. A
package manifest may declare `"bitakit": { "plugin", "configuration", "styles", "slots", "dependencies" }`.

## Startup

- `createRuntime(config, { actions, services })`, `runtime.mount()` returns `stop`;
  `runtime.ready` resolves after every `onStart`.
- Every startup error is a `FoundationStartupError` with `plugin`, `source` and the offending
  identifier in the message.
- Default feedback: silent success, one failure toast; `<id>.success` and `<id>.failure`
  locale keys are used when present; `success: false` silences.

## React (`@bitakit/ui`)

```tsx
const add = useAction('todos.add', title);          // state + props(), linkProps(), checkedProps(), valueProps(), menuItemProps()
<Button {...add.props()}>Add</Button>
<Action id="todos.add" input={title}><Button>Add</Button></Action>     // merges into the child
<Action id="todos.remove" input={item.id}>{({ pending, execute }) => ...}</Action>
<ActionButton action="todos.add" input={title} as={Button} />            // sugar on Action
const items = useServiceState('todos.items', (s) => s.items);            // reactive, waits for ready
const service = useService('todos.items');                               // the instance
useEvent('todos.changed', handler);
const nav = useActionGroup('navigation');
const { value, set } = useSetting('todos.pageSize');                       // confirmed value, writes through the runtime
const sections = useSettingsCatalog();                                     // sections for a settings UI
const navigation = useNavigation(['navigation']);                          // bound groups + pathname, Link, isActive
const badges = useSlot('app-bar.end');                                     // components plugins placed in a slot
<FoundationProvider config={bitakit} controls={{ button: (s) => ({ isDisabled: !s.enabled }) }} dialogs={{ sheet: SheetFrame }} />
const { pathname, params, navigate, Link } = useFoundationNavigation(); // the router contract
```

Framework adapters are one call: `defineFramework({ id, useRouter, QueryState })` returns the
`FoundationProvider` that feeds the host router (`pathname`, `params`, `navigate(href, { replace })`,
`Link`) and the query-state adapter into the runtime. `@bitakit/next` and `@bitakit/tanstack`
are two such calls; a third framework needs only a router hook. Values follow React renders,
so there is no separate subscription API.

Removed: `ActionBinding`, `ActionCheckbox`, `ActionRadioGroup`, `ActionMenuItem`,
`ActionGroupBinding`, `ActionMenuView`, `useWatchEvent`, `useFoundationReady`,
`app.optional.services`, `useRegisterActions`.

## Generated files

`src/bitakit.gen.tsx` (config, `BitaKitProvider`, type augmentations: `ServiceMap`, `ActionMap`,
`EventMap`, `SettingsMap`, `ConfigMap`, `SlotMap`), `src/bitakit.gen.css` (package styles),
`src/bitakit.gen.messages.json` (plugin locales). Configured in `bitakit.config.ts`. Gitignore
`src/bitakit.gen.*`. `SlotMap` collects the slots installed layouts declare in their package
manifest (`bitakit.slots`) plus `slots` from `bitakit.config.ts`; `doctor` warns when a slot
file targets a slot nobody renders. App layouts come from `src/layouts/<name>.tsx`.

## Removed in Phase 5

The 0.1 shims are gone: `provideService`, `defineURLAction`, `defineDialogAction`,
`definePage`, `defineView`, `defineSetup`, `defineServiceInterceptor`, the object form of
`defineService`, action `resolve` and `watch`, `publicServices`, `appExtensions`, top-level
`pages`/`views`/`providers` on plugins, `events.watch`, `useWatchEvent`, `withFoundation`,
`@bitakit/next/generated`, `@bitakit/tanstack/generated`, `createFoundationConfig` and
`foundation.config.ts`. `bitakit migrate` still rewrites the old spellings and `bitakit doctor`
still names them.
