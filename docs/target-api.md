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

A plugin can start with one page file, as shown in the
[Counter learning path](../apps/docs/content/docs/concepts/plugins.mdx).
A headless feature might instead start with these two files; add others only when needed:

```text
src/plugins/todos/
├── services/tasks.ts         defineService   → services.todos.tasks
└── actions/add.ts            defineAction    → todos.add
```

The complete layout:

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

- Navigation: `defineAction({ title: 'Todos', href: '/todos', slots: ['shell.navigation'] })`.
- Header toolbar: `defineAction({ title: 'Add', slots: ['shell.toolbar'], execute })`.
  Shell renders standard bound buttons/links before `shell.header.end` in both layouts.
  The existing header component slots remain available for custom widgets.
- Dialog: `defineAction({ title: 'Rename', dialog: RenameDialog })` or
  `dialog: { component: RenameDialog, kind: 'sheet', size: 'wide' }`; the component receives
  `{ input, close, services }`. The action names a frame `kind`; the host registers frames on
  `FoundationProvider` (`dialogs={{ sheet: SheetFrame }}`) and decides the appearance.
  `dialog` and `command` (a search palette without a visible header) are built in.
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
    theme: setting({
      default: 'system',
      options: [{ value: 'light' }, { value: 'dark' }, { value: 'system' }],
      control: 'cards',
    }),
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

## Lifecycle completion and host policy

`stop()` and the function returned by `mount()` return the same `Promise<void>` for that
mount. Await it before replacing a runtime. Shutdown cancels owned Actions, waits for
in-flight Actions and startup hooks, then awaits owned setup/contribution cleanup and
service `onStop` hooks in reverse dependency order. Providers stay available during
cleanup. All cleanup runs even after an error; completion rejects with `AggregateError`.
Failed cleanup blocks remount. No timeout reports unfinished work as stopped.

```ts
const runtime = createRuntime(config);
const stop = runtime.mount();
try {
  await runtime.ready;
  // Use services and Actions.
} finally {
  await stop();
}
```

`runtime.lifecycle.get()` reads the retained immutable snapshot; `watch(listener)`
subscribes and immediately supplies current state. `runtime.lifecycle.subscribe(listener)`
only observes changes. Snapshots separate `enabled` intent from `phase`, include per-plugin
and per-service readiness, generation and cleanup status. Only configured plugins and runtime-owned services appear; host-provided services retain host ownership.
Startup is still serial, and plugin readiness includes its declared dependencies. The existing event bus also publishes `runtime.lifecycle`; plugins
can listen but cannot emit into that reserved namespace.

```ts
const host = createRuntimeController(config, { failures: 'isolate' });
const unwatch = host.subscribe(() => console.log(host.get()));
host.mount();
try {
  await host.ready;
} finally {
  await host.stop();
  unwatch();
}
```

The controller defaults to `fail-fast`. With `isolate`, an attributed plugin startup failure
blocks its explicit dependents and required-service consumers. It fully stops the failed
composition before retrying the remaining plugins; app failures and failed cleanup are
fatal. This does not preserve unrelated service instances across retries. React's
`FoundationProvider` uses the same policies and waits for the previous stop before starting
a replacement, including rapid configuration changes.

Register `onStart` during factory construction. `onStop` can also be registered when an
awaited start hook acquires a resource, until disposal begins. `scope.own(cleanup)` rejects
registration after scope closure. A late cancelled start is awaited and never makes the
runtime ready. Arbitrary service calls and background work must cooperate with their owner's
cleanup; only runtime-tracked Actions and startup hooks are drained automatically. Request
management from the host: never return or await the enclosing runtime's stop promise from
one of its own hooks or Actions, because that would wait on itself.

Missing service reads, including `auth` and `i18n`, throw `FoundationServiceError` consistently.
Use `app.has(name)` before optional reads (`name in services` inside a service factory), or
`requires` for a mandatory provider. Optional chaining does not test registration. Generated
types describe declared providers; optional contract types remain conservative and do not
promise that a provider is mounted. `requires` belongs to the consumer.

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
const navigation = useNavigation('shell.navigation');                      // bound items + pathname, Link, isActive
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
`ActionGroupBinding`, `ActionMenuView`, `useWatchEvent`,
`app.optional.services`, `useRegisterActions`.

## Generated files

`src/bitakit.gen.tsx` (config, `BitaKitProvider`, type augmentations: `ServiceMap`, `ActionMap`,
`EventMap`, `SettingsMap`, `ConfigMap`, `SlotMap`), `src/bitakit.gen.css` (package styles),
`src/bitakit.gen.messages.json` (plugin locales). Configured in `bitakit.config.ts`. Gitignore
`src/bitakit.gen.*`. `SlotMap` contains owned `defineSlot` contracts from files and packages.
`LegacySlotMap` retains old manifest/config slot-name hints without declaring contracts.
Doctor checks known targets and duplicate declarations; computed records are reported as unresolved. App layouts come from `src/layouts/<name>.tsx`.

## Removed in Phase 5

The 0.1 shims are gone: `provideService`, `defineURLAction`, `defineDialogAction`,
`definePage`, `defineView`, `defineSetup`, `defineServiceInterceptor`, the object form of
`defineService`, action `resolve` and `watch`, `publicServices`, `appExtensions`, top-level
`pages`/`views`/`providers` on plugins, `events.watch`, `useWatchEvent`, `withFoundation`,
`@bitakit/next/generated`, `@bitakit/tanstack/generated`, `createFoundationConfig` and
`foundation.config.ts`. `bitakit migrate` still rewrites the old spellings and `bitakit doctor`
still names them.

#### Additional settings pages

`ui.settings` accepts the existing `{ component }` and optional `pages` entries
`{ id, component, title, path?, category?, order?, description?, icon?, shortcut? }`.
Discovery's `ui/settings/page.tsx` default export may provide the same object. Core keeps
components opaque; the shared UI catalog projects the declarations into settings routes and
navigation. This adds no service registry, value store or host routing code.

A custom settings page may set `ui.settings.showHeader: false` when it owns the shared page header. `PageHeader.before` provides an above-title navigation slot.

Plugin catalog metadata supports optional `tags: readonly string[]` and `coverImage`.
Local plugin manifests use `metadata`; `bitakit build` copies these fields from package.json.
Tags are catalog labels, not access rules. App Preferences derives filter choices from this
metadata and stores the selected tags in the repeated `pluginTag` URL parameters. Missing covers fall
back to the plugin icon.

## Owned slot definitions

```ts
// src/plugins/shell/slots/header/actions.ts → shell.header.actions
import { defineSlot } from '@bitakit/core';
export default defineSlot({ accepts: 'actions', policy: 'list' });
```

```ts
// Manual equivalent; dotted and nested keys use the same normalizer.
definePlugin({
  id: 'shell',
  slots: {
    header: { actions: defineSlot({ accepts: 'actions' }) },
  },
});
```

| Contract                   | Meaning                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `accepts: 'actions'`       | References to existing Actions; no second execution registry |
| `accepts: 'component'`     | Opaque custom UI, interpreted by the UI owner                |
| `accepts: 'data', schema`  | Structured contributions validated with existing schemas     |
| `payload`                  | Schema for context supplied by the slot owner                |
| `policy: 'list'` (default) | Multiple entries, ordered when attached                      |
| `policy: 'single'`         | One occupant; additional occupant is a conflict              |
| `policy: 'keyed'`          | One occupant per key; duplicate keys conflict                |

Definitions are immutable and carry `conflict: 'error'`. The declaration phase records these
contracts; scoped attachment enforces cardinality and owner readiness. Declaring a
slot does not render anything or mark its owner ready. Inventory is `runtime.modules[].slots`.

App declarations under `src/slots` use plain names, regardless of `appId`. Plugins qualify
inferred names with their ID. An explicit `id` is absolute; arrays require it. Flat filenames,
nested folders, dotted/nested records and `index.ts` collections are alternative spellings.
Canonical duplicates fail with owner/source attribution. `ui/slots/` stays the separate existing
component-contribution convention. Groups retain logical membership; Actions use explicit placements. Settings page projection remains separate.

`SlotPayload<'shell.header.actions'>` derives the context type from a payload schema;
`SlotData<'name'>` derives contributed data. Without a payload schema, the payload is `undefined`.
Both helpers also accept `typeof definition`. Manual plugins can derive a map with
`PublicSlotsOf<typeof plugins>`; discovered apps and built plugin packages augment `SlotMap`.
Schema values use the existing `validate`/`validateSync` support; Core does not execute a schema
when it creates a definition.

## Owned slot attachments

```ts
// setup.ts — app is the existing PluginScope; there is no second registry.
// Context inferred when this function is supplied as definePlugin({ setup }).
definePlugin({
  id: 'editor',
  setup: ({ app }) => {
    const placement = app.slots.attach(
      'shell.header.actions',
      {
        id: 'save-button',
        actionId: 'editor.save',
        order: 10,
      },
      { availability: 'wait' },
    );

    app.slots.watch('shell.header.actions', (snapshot) => {
      console.log(snapshot.phase, snapshot.generation, snapshot.items);
    }); // current state first, then changes; removed when this scope closes

    void placement.ready.catch((error) => console.error(error));
    // placement.dispose() removes this reference early; plugin stop removes it automatically.
  },
});
```

| API / rule                  | Behavior                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| Default `require`           | Throws `SlotError` if the known owner's slot is not ready at admission        |
| `wait`                      | Retains a pending attachment to a known definition; unknown names still throw |
| `get`, `subscribe`, `watch` | Current immutable snapshot, future updates, or current plus future            |
| `runtime.slots`             | Host read API; callers release their subscriptions                            |
| `app.slots`                 | Scope-owned attach and observers; automatic cleanup on contributor close      |
| `placement.ready`           | First successful attachment; rejects on validation failure or early disposal  |
| `placement.get()`           | `pending`, `attached`, `detached` or `failed`, with reason/failure            |
| `runtime.slot`              | Notification on the existing reserved bus; use watch for late subscribers     |
| Sorting / occupancy         | Ascending order, insertion order for ties; pending entries reserve IDs/keys   |

An attachment becomes visible only when its owner and contributor are ready and validation
has succeeded. Both policies follow subsequent availability and generations. A stopped owner
hides entries; a closed contributor permanently removes them. Targeted host updates use this same state
contract; unsupported structural changes require composition replacement. Data uses the existing schema support
once; late results cannot resurrect disposed attachments. Action entries reference the one
ActionList and do not copy its presentation or execution state.

`ui/slots/<target>.tsx` and manual `ui.slots` contributions targeting a declared component slot
use this same path, with wait by default. Files may export `id`, `key`, `order`, `availability`.
Sources survive discovery and package builds for diagnostics. Undeclared legacy outlets retain
the existing behavior until the placement migration. A mounted outlet does not own the
attachment: hiding and remounting it preserves the contribution. React retains the existing
runtime-wide readiness barrier because service hooks still use it. Definitions are composed
before mount, not dynamically installed at runtime. Settings page projection remains separate.

## Explicit UI placement

| Author            | Declaration                                      | Responsibility                                    |
| ----------------- | ------------------------------------------------ | ------------------------------------------------- |
| Owner             | `defineSlot({ accepts, payload?, policy? })`     | Accepted content, context and standard rendering  |
| Action            | `slots: ['shell.navigation']`                    | References one registered Action                  |
| Contextual Action | `slots: [{ name, input: ({ payload }) => ... }]` | Maps each outlet's context to Action input        |
| Widget            | `ui/slots/<target>.tsx`                          | Custom component in a component slot              |
| Host              | `useSlot(name, { payload })`                     | Reads items/pending/error; never owns attachments |

```ts
// src/plugins/audit/actions/inspect.ts
export default defineAction<string>({
  title: ({ input }) => `Inspect ${input}`,
  groups: ['audit'], // logical membership only
  slots: [
    {
      name: 'organizations.member.menu',
      input: ({ payload }) => payload.memberId,
      order: 50,
    },
  ],
  execute: ({ input }) => console.log(input),
});
```

```tsx
const menu = useSlot('organizations.member.menu', {
  payload: { organizationId, memberId },
});
if (menu.error) throw menu.error;
return menu.items.map((item) => (
  <Action key={item.key} id={item.action} kind="menuItem">
    <DropdownMenuItem />
  </Action>
));
```

The owner uses its existing themed components. A link binds with `kind="link"` and a real
anchor; it must not also execute a button handler. `ActionButton` and `ActionLink` accept
the bound control too. A control keeps its mapped input when rebound; explicit input overrides it.
Resolved controls remain usable under strict generated Action IDs. Literal IDs still have to
exist in the generated map, and supplying input cannot widen a known Action's input type.

Each mounted outlet validates its payload separately; pending/invalid payloads expose no items.
Stale async validation cannot replace a newer payload. Keep nested payload references stable.
`useSlot` returns `{ items, payload, pending, error }`; items have `kind: 'action' | 'component' | 'data'`.
`PluginSlot` renders component entries, passing the parsed `payload` prop. Action placements
default to waiting for a known owner; they never invent an undeclared slot. Internal Actions are
excluded. Changes to groups do not move placements or create new Action registrations.

Shell uses `navigationSlot` (default `shell.navigation`) instead of a `groups` option.
Member-menu extensions use `organizations.member.menu` instead of group membership for placement.
Other existing group renderers remain available for explicit logical queries.

## Slot render-error isolation

`PluginSlot` wraps each component entry with `SlotErrorBoundary` from `@bitakit/ui`, backed by
`react-error-boundary`. React, recovery UI and error causes stay out of Core. There is no second
attachment registry, error inventory or lifecycle engine. Healthy sibling keys remain stable.

| API | Contract |
| --- | --- |
| `PluginSlot.errorFallback({ error, retry })` | Optional per-occurrence recovery rendering; default uses the existing host Button and translated copy. |
| `SlotErrorBoundary({ slot, plugin, contribution, children, errorFallback? })` | The same boundary for custom `useSlot` renderers and settings page bodies. Place inside access boundaries. |
| `SlotRenderError` | Error with `slot`, contributing `plugin`, `contribution` and original `cause`; default recovery does not print the cause. |
| `FoundationProvider.actionOptions.onError` | Existing local reporting callback receives an attributed render error. A throwing reporter cannot remove recovery UI. |

Retry is explicit or follows a changed raw owner definition/direct child component/runtime.
Global revision, normalized module identity and unstable payload objects are not reset keys.
A retry clears only this boundary; it neither restarts a plugin nor registers another contribution.
Slot instances fail independently. Unmount/hide removes their local boundary without altering
shared registration. A failed fallback propagates to an outer boundary, per React semantics.

Payload validation and binding errors remain `useSlot().error` and propagate from `PluginSlot`.
Pending Suspense, event-handler/later asynchronous failures, server rendering and startup
failures retain their own mechanisms. A caught widget failure does not mark its owner stopped.
App Preferences attributes a custom/generated body to its actual page owner, and leaves body,
extension fallbacks and retries inside the existing page access boundary.

## Settings slot projection

`@bitakit/app-preferences` projects the existing catalog into `app-preferences.navigation`
(Action list) and `app-preferences.page.body` (component, keyed by stable catalog ID).
`page.after` accepts ordered component extensions, `page.toolbar` accepts contextual Actions,
and `navigation.footer` accepts widgets. Page outlets pass `{ pageId }`.

```tsx
const payload = { pageId: section.id };
<PluginSlot name="app-preferences.page.body" entryKey={section.id} payload={payload} />;
<PluginSlot name="app-preferences.page.after" payload={payload} />;
```

The standard Settings host renders these inside the page's optional `boundary`. Additional
pages inherit that boundary or override it, retain `{ section, renderField }`, and can specify
`showHeader`. Existing storage, values, paths, search and translations remain authoritative.
A slot file can export `when: SlotPredicate<'slot'>` to select a page after payload validation;
this is a local presentation filter, never a permission or global registration event.

```tsx
// ui/slots/app-preferences.page.after.tsx
export const when: SlotPredicate<'app-preferences.page.after'> = ({ payload }) =>
  payload.pageId === 'billing/history';
```

Catalog projection cleanup follows `scopeLifecycle(scope)` (the same read-only lifecycle state,
with scope-owned observers). The projection's references belong to App Preferences; source
removal revokes its derived references. React retains the initial startup barrier;
supported host updates restart composition-reading projections and preserve unrelated services.

## Host-driven plugin updates

`runtime.reconcilePlugins(nextPlugins)` is an explicit host operation on already loaded,
immutable plugin definitions. Its first consumer is development/manual composition that needs
to preserve unrelated service instances and stores. It is not an automatic discovery/HMR hook.

```ts
// Host code, after initial runtime.ready. Keep unchanged definitions by reference.
const next = (runtime.config.plugins ?? []).map((plugin) =>
  plugin.id === updated.id ? updated : plugin,
);
const result = await runtime.reconcilePlugins(next);
console.log(result.status, result.revision, result.changed, result.affected, result.reasons);
```

| Result             | Meaning                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `applied`          | Selected plugins finished starting; unchanged instances survive. No-op retains revision.  |
| `restart-required` | Unsupported structural change detected before mutation; host may replace composition.     |
| `blocked`          | Invalid proposal, overlapping operation, shutdown or earlier failed cleanup.              |
| `failed`           | A stop/start failed; inspect lifecycle, repair and explicitly retry if cleanup completed. |

Supported updates retain plugin IDs/order, service IDs/aliases/required-service shape and the
same settings, events, config and slot declarations. Change implementations, Actions, setup,
pages, widgets or metadata by passing a new plugin object; never mutate existing definitions.
Definition comparison is referential, not a code hash or deep schema comparison. Reconstructed
foundational declarations conservatively require replacement even if structurally similar.

The affected set includes declared plugin dependents, required-service consumers and scopes
that read composition with `scopeModules`/`scopePlugins`. Dependents stop before providers;
selected services start serially in dependency order. Owned Actions are cancelled and drained,
scopes revoke contributions immediately, then cleanup is awaited. Unrelated services stay alive.
Declare dependencies for captured cross-plugin services; optional reads alone do not create edges.

Adding/removing/reordering plugins, changing service names/contracts, replacing the app,
providers, installers/interceptors, or auth/i18n/settings-storage providers requires a full
composition replacement. No live package installation or arbitrary code evaluation is provided.
Child scopes and parallel startup remain deferred until a consumer requires them.

A failed start cleans the partial affected set and permits an explicit new attempt. Failed
cleanup blocks further updates and remount; stop still attempts remaining cleanup and rejects.
Recovery does not roll back external effects or resurrect old state. Revision increments when
the new definitions are committed, even if their subsequent startup fails; check the result and
lifecycle, not revision alone. Initial readiness stays true during compatible updates, including
an affected owner's failure. Unaffected pages and widgets remain mounted; affected owners lose
their UI contributions until ready. A page owned by an affected plugin can lose its local drafts.

| Readiness query | Meaning |
| --- | --- |
| `runtime.isReady()` / `app.ready` / `useFoundationReady()` | Initial startup completed; false again when full shutdown begins. Not aggregate update success. |
| `runtime.isReady(pluginId)` / `useFoundationReady(pluginId)` | Initial readiness plus this plugin's current ready phase. |
| `runtime.isServiceReady(name)` / `app.has(name)` | The service and its owner are ready; aliases resolve to the same instance. |
| `runtime.hasService(name)` | Raw container presence, including instances still needed by cleanup; not a UI readiness check. |

`subscribeReady` observes global readiness; subscribe to `runtime.lifecycle` for owner
transitions. React hooks combine both without a second store. `useService` follows ready
instance replacement, and `useServiceState` keeps an unchanged source subscribed through
unrelated transitions. `PluginPage` checks the matched owner; its optional `unavailable` prop
renders during that owner's pending/failed/blocked state. `useSlot` exposes the declared owner's
`phase`; failed/blocked is not indefinite `pending`. Validation failures remain `error`.
Affected dialogs close before replacement, so an old definition cannot reopen afterward.
The existing Action adapter also hides/disables an unavailable owner's Actions before evaluating
dynamic presentation, including direct bindings outside slots. It cannot run against a starting service.

Scopes reading the complete composition (including App Preferences projections) remain in the
affected set. Their Settings bodies can remount; this phase does not promise preservation for
affected projections, changed component types, owner removal or whole-runtime replacement.

Invoke and await updates from host management code, never from an affected Action, setup/start
hook or disposer: otherwise the operation can wait for its own caller. `runtime.ready` remains
the initial-mount promise; await the update result for later readiness. React provider config
changes still replace the whole runtime. File-based Next refresh has separate full-reload and
stale-import limitations; these APIs do not claim state-preserving file HMR.

## Shared inspection schema

```ts
import { inspectRuntime, observeRuntimeInventory } from '@bitakit/core';

const snapshot = inspectRuntime(runtime);
// { version: 1, static: { plugins: [...] }, live: { revision, phase, plugins, services, actions, slots } }
const reader = observeRuntimeInventory(runtime);
const unsubscribe = reader.subscribe(() => console.log(reader.get()));
// Release the observer when the host view closes.
unsubscribe();
```

```tsx
import { useRuntimeInventory } from '@bitakit/ui';

function Status() {
  const inventory = useRuntimeInventory();
  return <output>{inventory.live?.phase}</output>;
}
```

| Field                                  | Evidence and limits                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `static.plugins`                       | IDs, configured enablement, public metadata, dependency names and declarations.                      |
| `source` / declaration `source`        | File/package/runtime attribution; `null` when unavailable.                                           |
| Declaration `resolution`               | `file` is static file evidence; `resolved` is a known declaration ID.                                |
| `live`                                 | Runtime phase/revision, plugin/service phases, public Action flags and slot counts; CLI uses `null`. |
| Missing package plugin ID/declarations | `null`, never guessed by executing installed plugins.                                                |

`bitakit info` and `info --json`, Devtools and the App Preferences plugin overview use this
version-1 vocabulary. CLI inventory is static and retains disabled local plugins. Runtime
inventory describes the current composed runtime; plugins filtered out by controller isolation
are reported in controller diagnostics, not invented as runtime instances. It is not a merged
remote management catalog. The JSON shape replaces the older raw discovery output.

Inspection omits config/settings values and defaults, service/store contents, Action
inputs/results/errors, callbacks, icons and component payloads. Public metadata and source paths
are intentionally visible, so do not put secrets in them. `createInventory` builds the shared
DTO envelope; it does not scrub arbitrary data supplied by a caller. Interactive Devtools
execution, event recording and service inspection still use their existing APIs and may expose
application values. Snapshot identity is retained while its source snapshots are unchanged.


## Runtime diagnostics

`runtime.lifecycle.get()` reports an active `operation` (`start`, `stop`, or `update`)
and its `startedAt` time. Plugin/service entries have `since` timestamps for their current
phase. Compute elapsed time at the observer; Core does not run a diagnostic timer.
`inspectRuntime()` includes those times and cleanup status, without raw errors or values.

| Read | Meaning | Not evidence of |
| --- | --- | --- |
| `inventory.live.slots[].count` | Attached contributions | Mounted or visible UI |
| `mountedOutlets`, `visibleCount`, `renderFailures` | `null`: not observed by Core | Zero outlets or errors |
| `useSlot(name).diagnostics` | This outlet's selected entries and exclusions | Successful render or on-screen visibility |
| `SlotRenderError` / recovery UI | A render failure, attributed to contribution and owner | A failed plugin lifecycle |

Outlet diagnostics name initialization, owner unavailability, update pending, payload
validation/failure, key/condition filtering, hidden/missing Actions and binding errors.
They contain identifiers and counts, never payloads or causes. Read them at the real
outlet; a second diagnostic outlet would have different context.

Devtools `Inspector` shows pending work with elapsed seconds. `stalledAfterMs` changes
its advisory threshold (default 10 seconds). Escalation is reporting/investigating the named
hook, then stopping the host process if necessary. A deadline never completes cleanup,
starts an overlapping replacement, cancels a promise or grants access. Static CLI inventory
continues to return `live: null`.


## Development refresh

Framework hosts generate a component-only `bitakit.gen.tsx` and a client-side
`bitakit.gen.config.ts` for configuration/type maps. Normal hosts keep importing
`BitaKitProvider` from `bitakit.gen`. Advanced consumers that previously imported
`createBitaKitConfig` there now import it from `bitakit.gen.config`. Without a framework,
`bitakit.gen.ts` remains the configuration entry. Do not hand-edit generated files.

The watcher writes complete files atomically and regenerates promptly on filesystem renames.
A watch session reuses its audited installed-package graph for local source-only changes;
package metadata, configuration selection, styles and external watched files invalidate it.
The cache contains package discovery results, never application values or a second runtime.

Next development checks cover add/edit/delete, whole-plugin removal and collection leaf removal,
with a preserved document token and page draft. This is bundler Fast Refresh followed by an
awaited composition replacement, not `reconcilePlugins` or arbitrary code hot replacement.
Affected slot/form state can remount during composition replacement; compatible explicit
runtime updates retain Phase 8's owner-specific guarantees. Named components are the supported
React refresh path. Structural provider changes, server code, dependency installation and
changes outside a React refresh boundary can require a host restart/reload. Restart the dev
server after changing Node-loaded generator/integration code. No universal HMR promise.


## Shared layouts and extension regions

Shell owns `brand`, `header.start/center/end`, `header.rows`, contextual `header.row.start/end`,
`content.before/after`, `footer`, `drawer.header/body/footer`, `navigation.group.before/after`
and optional `state.content/actions` under the `shell.` prefix. Existing `sidebar.header/footer`,
`sidebar.body`, `app-bar.end` and the Action slots `shell.navigation` and `shell.toolbar` remain explicit contracts.
`ShellSurface` is the shared base for `AppShell.Content` and `AppShell.FullPage`; named layouts
use the existing `src/layouts/` convention. `blank` remains bare. Render children once.

Use `AppShell.HeaderRow` with a unique row ID, `AppShell.NavigationGroup` with an explicit Action
slot, and `AppShell.Drawer` with a unique drawer ID. Contributions filter rowId/groupId/drawerId
through `when`; omitting it intentionally selects all occurrences. Radix Sheet retains focus
and modality; side is logical start/end, with explicit/inherited Radix direction.

`PageState`/error helpers accept `content` for composition and optional `surfaceId` for keyed
message/list recovery regions. Core is never required for host-owned fallback/retry. Optional
regions are guarded against missing/stopped runtimes and client render failures. This does not
catch SSR or arbitrary asynchronous errors. Essential recovery stays outside failing plugins.

App Preferences additionally owns `navigation.header`, `navigation.group.before/after` with
`groupId`, and `page.header/before/footer` with `pageId`. Page regions remain inside the existing
page access boundary. Navigation-shell regions are not protected by an individual page boundary.
No second Settings catalog, store, route registry or layout engine is introduced.

Progressive examples and the full region table: `apps/docs/content/docs/reference/layouts.mdx`.
