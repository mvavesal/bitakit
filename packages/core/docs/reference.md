# Core reference

Framework-independent plugins, services, actions, events, configuration and interceptors.
React bindings live in `@bitakit/ui`; framework adapters in `@bitakit/next` and
`@bitakit/tanstack`. Core does not create another ActionProvider, settings store, router,
authentication session or API client.

The folder conventions and `bitakit.config.ts` are documented in
[File contributions and config](file-contributions.md); events in [Events](events.md).

## Vocabulary

| Term        | Meaning                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| Plugin      | A folder under `src/plugins/<id>/` or an npm package. The folder name is the ID.            |
| Service     | Behavior and state. ID `<plugin>.<file>`, reached as `services.<plugin>.<file>`.            |
| Action      | An operation with presentation (title, enabled, pending). ID `<plugin>.<file>`.             |
| Event       | A typed notification, `<plugin>.<name>`, declared once in `events.ts`.                      |
| Config      | Build-time, immutable developer input. User preferences belong to App Preferences.          |
| Interceptor | Observes or gates actions, or observes service methods.                                     |
| Contract    | A typed service key any plugin may provide (`auth`, `i18n`), created with `defineContract`. |
| UI          | Everything under `ui/`: pages, slots, dialogs, providers. React only.                       |

`define*` describes behavior that runs anywhere. A component is UI and never needs `define*`.

## Services

```ts
import { defineService } from '@bitakit/core';

export default defineService(
  ({ services, config, events, store, onStart, onStop }) => {
    const state = store<{ items: Item[] }>({ items: [] });
    onStart(async ({ signal }) => {
      /* awaited before the app is ready */
    });
    onStop(() => {
      /* cleanup, reverse order */
    });
    return {
      state,
      add(title: string) {
        state.set((s) => ({ items: [...s.items, { id: Date.now(), title }] }));
        events.emit('todos.changed', { kind: 'added' });
      },
    };
  },
  { requires: ['billing.invoices'], provides: authContract, exposeAs: 'items' },
);
```

The factory receives one context object. Options are optional:

- `requires` lists services the factory reads while it runs. Core creates services in that
  order and reports cycles. A missing service fails at startup with a named error whether
  or not it is listed; listing it only moves the error to the earliest moment.
- `provides` registers the instance under a contract key as well, such as `auth`.
- `exposeAs` adds a flat alias in `services`; use it only for deliberate flattening.
- `id` is for manual composition only; discovery derives `<plugin>.<file>`.

`store(initial)` returns `{ get, set, subscribe, optimistic }`. `set` takes a value or an
updater. `optimistic(apply, commit, { reconcile, revert })` applies a change, awaits the
commit and rolls back when it fails. Anything a service exposes with `subscribe(listener)`
is observed by the runtime: actions re-evaluate their function-valued fields and
`useServiceState` re-renders when it changes. Services never notify by hand.

Service names form a tree: `todos.items` is `services.todos.items`; aliases are extra paths
onto the same instance. Two services with the same name, or a name that is also a
namespace, fail at startup. Reading an unknown or not-yet-created service throws a
`FoundationServiceError` with `service` and `reason` (`not-ready`, `unregistered`, `missing`).

## Actions

```ts
import { defineAction } from '@bitakit/core';
import { z } from 'zod';

export default defineAction({
  title: 'Add item',
  input: z.string().min(1),
  enabled: ({ input }) => input.trim().length > 0,
  visible: ({ services }) => services.todos.items.state.get().items.length < 100,
  groups: ['todos.toolbar'],
  shortcut: { keys: 'Mod+Enter' },
  concurrency: 'per-input',
  confirm: ({ input }) => ({ title: 'Add this item?', description: input }),
  execute: ({ services, input, signal }) => services.todos.items.add(input),
  success: ({ result }) => 'Item added',
  failure: ({ error }) => undefined,
});
```

| Field                                    | Meaning                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `title`, `description`, `tooltip`        | Texts. A literal or a translation key; the `<id>.title` (`.description`, `.tooltip`) key wins when the catalog has it. |
| `icon`, `variant`                        | Presentation stored for renderers; `variant` is `'default'` or `'destructive'`.                                        |
| `enabled`, `visible`, `checked`, `value` | Availability and control state.                                                                                        |
| `href`                                   | A navigation action: rendered as a link, executed as navigation. Root-relative path, `#hash` or `http(s)` URL.         |
| `input`                                  | Schema (`parse` or Standard Schema). Types `input`, validates before `execute`, disables while the input is invalid.   |
| `execute`                                | The operation; sync or async. Pending is set only when a promise is returned.                                          |
| `dialog`, `dialogSize`                   | Opens the component in the host dialog instead of running `execute`; `'default'` or `'wide'`.                          |
| `confirm`                                | `string`, `{ title, description, destructive? }`, `false`, or a function; declining skips with reason `cancelled`.     |
| `concurrency`, `concurrencyKey`          | `exclusive` (default) skips while running, `per-input` tracks each input, `latest` aborts the previous run.            |
| `success`, `failure`                     | Feedback: string, key, `{ message, messageKey, values, closeDialog }`, `false`, or a function.                         |
| `groups`, `order`, `dividerBefore`       | Grouping and display hints for menus and navigation.                                                                   |
| `shortcut`                               | `{ keys, input?, scope?, allowInInputs? }`; browser handling belongs to the UI ActionProvider.                         |
| `requires`                               | Services from other plugins; checked at startup.                                                                       |
| `internal`                               | Executable by ID but excluded from menus, search, enumeration and typed references.                                    |
| `metadata`                               | Opaque host data; Core never interprets it.                                                                            |
| `id`                                     | Manual composition only; discovery derives `<plugin>.<file>`.                                                          |

Every presentation field (`title`, `description`, `tooltip`, `icon`, `variant`, `href`,
`enabled`, `visible`, `checked`, `value`) accepts a value or a function of
`{ input, services, config, app }`. Functions run per binding input and again whenever a
store they read changes; two buttons of one action can therefore show different states.
The `execute` context is `{ input, services, config, app, events, signal, id, get, update, environment }`.
`signal` aborts when the registration is disposed or a newer `latest` run supersedes this one.

Typing: with a schema, `input` and the result are inferred. Without one, name the input:
`defineAction<string>({ ... })` (the result is then `unknown`; `defineAction<string, number>`
names both). An action opens a dialog or runs `execute`, not both; the dialog component
receives `{ input, close, services }` and runs its logic itself.

Execution resolves to `{ status: 'completed', value }` or `{ status: 'skipped', reason }` with
the reasons `missing`, `disabled`, `hidden`, `pending`, `no-handler`, `intercepted`,
`cancelled` or `replaced`; a throwing `execute` rejects with an `ActionFailure` whose `cause`
is the original error. `app.actions.todos.add.execute('Milk')` is a typed reference to the
same registration; `runtime.actions.execute('todos.add', 'Milk')` is the string form.

## Events

Declared once per plugin in `events.ts` with `defineEvents({ name: event<Payload>() })`,
emitted and observed as `<plugin>.<name>`, owner-only emit, optional `cancelable` events
whose `emit` resolves to `boolean`. See [Events](events.md).

## Configuration

```ts
// configs/limits.ts
import { defineConfig } from '@bitakit/core';
import { z } from 'zod';

export default defineConfig({
  schema: z.object({ maxItems: z.number() }),
  defaults: { maxItems: 100 },
});
```

`defineConfig({ defaults })`, `defineConfig({ schema })` or both; a config file may also
export a plain object. Each file under `configs/` contributes the subtree named by its path
(`configs/limits.ts` → `limits`, `configs/actions/add.ts` → `actions.add`); a root
`configs.ts` or `configs/index.ts` with a schema must own the complete config. Schemas
validate synchronously on the merged values before services start; a failure is a startup
error of that plugin.

Reading:

```ts
app.config.todos.limits.maxItems; // typed from ConfigMap
config.plugin.get('limits.maxItems', 100); // in contexts; typed by the fallback
config.action.get('defaultTitle', 'Untitled'); // this action's subtree: configs/actions/<action>.ts
```

`config.plugin` is the plugin's whole tree; `config.action` is positioned at
`actions.<action path>`. There is no implicit fallback between the two scopes. A fallback
supplies a value and a type, not runtime validation. Low-level: `runtime.configuration.plugin(id)`
returns the `ConfigScope` (`get`, `scope`, `snapshot`).

Overrides live in `bitakit.config.ts`: `configOverrides: { todos: { limits: { maxItems: 50 } } }`.
Objects merge recursively, arrays replace, `undefined` keeps the default, `null` is explicit.
Overrides for unknown plugin IDs are rejected; overrides for disabled plugins are dropped.
Config is a frozen snapshot per runtime: no write API, no automatic service recreation.
Configuration shipped in client contributions is client-visible; keep secrets on the server.

## Interceptors

```ts
import { defineInterceptor } from '@bitakit/core';

export default defineInterceptor({
  action: 'todos.*', // exact IDs, 'todos.*' or '*'
  order: 10,
  before: ({ id, input, services }) => false, // false cancels (reason "intercepted")
  after: ({ id, result }) => {},
  onError: ({ id, error }) => {},
});

export default defineInterceptor({ service: 'todos.items', method: 'add', before, after, onError });
```

`action` and `service` are mutually exclusive; export an array for both. A definition
without a target observes every action of its own plugin. Plugin interceptors match only
their own plugin's actions unless `scope: 'global'`; app interceptors are global unless
`scope: 'plugin'`. `order` sorts ascending with stable ties. `before` may return a promise.
The action context is the execute context plus `translate`.

Service hooks observe only: `before({ service, method, args })`, `after({ ..., result })`,
`onError({ ..., error })`. Return values are ignored, failures are isolated, promises are not
awaited; the original sync return, promise identity and errors are preserved. Omit `method`
to observe every public method. Internal self-calls bypass observation.

## Plugins and manual composition

```ts
import { definePlugin } from '@bitakit/core';

export default definePlugin({
  id: 'todos',
  dependencies: ['shell'],
  metadata: { name: 'Todos', version: '1.0.0' },
  services: { items: itemsService },   // records keyed by name: IDs become todos.items
  actions: { add: addAction },         // todos.add
  events: todosEvents,
  config: { limits },                  // mirrors configs/limits.ts → app.config.todos.limits
  interceptors: [audit],
  setup: ({ app, services }) => () => {},
  ui: { pages: [...], slots: [...], providers: [...] },
});
```

Discovery generates exactly this shape. Arrays with explicit `id`s are also accepted.
`dependencies` orders startup and disables a plugin with its failed dependency; a missing or
cyclic dependency is a startup error that names the plugins. `setup` runs after the plugin's
actions are registered; its `app` is a `PluginScope` whose `actions.getGroup(id).attach(actionId)`
and `.add(definition)` register with automatic cleanup, and it may return a cleanup function.
Async setup is not supported; put async work in a service `onStart`.

The runtime treats the application itself as a module with the ID `app` (or the `id` from
`src/plugin.config.ts`). Its contributions are the top-level `FoundationConfig` fields; its
action and service IDs carry no prefix unless the manifest sets one.

## Runtime

```ts
import { createRuntime } from '@bitakit/core';

const runtime = createRuntime(config, { actions, services });
const stop = runtime.mount();
await runtime.ready;
runtime.services.todos.items.add('Milk');
await runtime.actions.execute('todos.add', 'Milk');
stop();
```

`createRuntime(config, { actions?, services? })` creates the ActionList unless you pass one
and accepts host-owned services under their contract names (`{ auth }`). `mount()` creates
services in dependency order, installs interceptors and contributions, registers actions and
runs `setup`; it returns the stop function. `ready` resolves after every `onStart`, or rejects
with the attributed startup error. The React provider mounts the runtime for you.

`runtime.app` is the facade every contribution sees as `app`:

| Member          | Meaning                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `app.services`  | Live tree; reading a missing or not-yet-ready service throws `FoundationServiceError`. |
| `app.actions`   | Typed references by dotted ID: `app.actions.todos.add.execute(input)`.                 |
| `app.config`    | Frozen snapshots per plugin: `app.config.todos.limits`.                                |
| `app.events`    | The runtime bus.                                                                       |
| `app.has(name)` | Whether a service is available right now, by ID or alias.                              |
| `app.ready`     | Whether the runtime is mounted.                                                        |

### Startup errors and isolation

Every startup failure is a `FoundationStartupError` with `plugin` (module ID), `app` (true when
the application module failed) and, when discovery recorded it, `source` (the file). Messages
name the offending identifier: duplicate IDs, dependency cycles, missing services with
suggestions, duplicate pages, invalid hrefs, failed `onStart`.

In development, `FoundationProvider` turns off the failed plugin and the plugins that depend
on it, shows a startup report and explains on the page when a component still requires one
of their services (check `app.has(...)` first). Production fails fast; `isolateFailures`
changes the default.

### Feedback and confirmation

Defaults: silent success, one failure toast per failed run. The `<id>.success` and
`<id>.failure` catalog keys are used when present; `success: false` silences; a failure
without any message shows the error message in development and a generic text in production.
Feedback callbacks receive `{ result, input, services }` or `{ error, input, services }` and
can never change the outcome. The runtime sends messages to the host's `notify(message, kind)`;
hosts must not toast the same `ActionFailure` again from `onError`.

`confirm` routes through the host confirmation dialog (`runtime.setConfirm`); without a
handler the action proceeds and warns once. Only one dialog is open at a time.

### Translation

The runtime resolves `title`, `description` and `tooltip` through the current translator:
the value as a key, then `<id>.title`, then the literal. Without a title, `<id>.title` and
then a readable form of the last ID segment are used (`todos.clear-all` → "Clear all").
Supply a translator with `has(key)` to avoid lookups of missing keys. Plugins contribute
catalogs in `locales/<lang>.json` under their own namespace; discovery merges them into
`src/bitakit.gen.messages.json`, and `mergePluginMessages` composes them with the app's
catalog (app current language, plugin current language, app fallback, plugin fallback).
The `i18n` contract (`TranslationService`) replaces the translator at runtime.

## Provider composition

`FoundationProvider` takes `config` (the generated configuration), `additionalPlugins`
(entries with an existing ID replace that plugin in place, new IDs append), `controls`,
`notify`, `services`, `translate`, `labels`, `ui`, `actionOptions` and `isolateFailures`.
The optional `actions`, `plugins`, `interceptors` and `providers` props follow one rule:
omitted inherits the generated configuration, an explicit array replaces that domain, an
empty array selects none. An explicit `actions` array also removes plugin actions; those
plugins' services and setup still run. Keep these values stable across renders.

React providers from `ui/providers/<name>.tsx` wrap the app outside-in in composition order;
`export const requires = ['other.provider']` must name providers that appear earlier.
Duplicate IDs and missing or reversed requirements fail before mounting.

## Integration contributions

Optional integrations add declarative contribution kinds without teaching Core their
meaning. A module lists values under `contributions: { [kind]: values }`; exactly one
module claims each kind with `installs: { [kind]: (values, { module, app, services }) => cleanup }`.
The runtime installs contributions after services, translation and interceptors and before
actions and setup, in dependency order; the cleanup belongs to the contributing module. A
kind without an installer, or claimed twice, fails the mount. Integrations type their kinds
by augmenting `ContributionMap`.

`runtime.contributionsOf(kind)` returns the same values before mount for an initial render
snapshot. `scopeModule(scope)` identifies the module of a runtime-issued `PluginScope`;
`scopePlugins(scope)` lists the composed plugins (ID and metadata). `runtime.destinationOf(action)`
tells search and overview UIs where a navigation action leads (`page`, `settings`, `plugin`)
and which plugin owns it, using `destinationMetadata({ kind, plugin })` when an integration
projected one. Discovery reads kinds from `bitakit.config.ts` (`kinds`) and from packages
(`bitakit.discovery`); their files live under `contributions/<folder>/` of every module.

## Plugin packages

A package opts into discovery through its manifest:

```json
{
  "exports": { "./package.json": "./package.json", "./plugin": "./dist/plugin.js" },
  "bitakit": { "plugin": "./plugin", "id": "notes", "styles": "./styles.css" }
}
```

The plugin entry default-exports a synchronous factory returning one `Plugin`. Optional
metadata: `configuration` (the app config path passed to the factory, such as `shell` for
`src/configs/shell.ts`), `styles` and `theme` (stylesheets written to `src/bitakit.gen.css`,
dependencies first, theme last) and `discovery` (a Node-safe module returning contribution
kinds). Direct dependencies and the plugin packages they depend on are activated; `packages:
false` or `packages: { '<name>': false }` in `bitakit.config.ts` opts out. `bitakit build`
produces this entry from the same folders apps use.

## Discovery entry

`@bitakit/core/discovery` is Node-only: `defineBitaKit(config)` types `bitakit.config.ts`,
`generateFoundation(root)` writes `src/bitakit.gen.*`, `watchFoundation(root)` regenerates
during development, `describeFoundation(root)` lists what discovery finds (used by
`bitakit info`) and `migrateProject(root, { dryRun })` rewrites a 0.1 layout. The browser never
reads the filesystem; contribution modules are imported, not executed, at generation time.

## Testing

```ts
import { mountPlugin } from '@bitakit/core/testing';

const plugin = await mountPlugin('src/plugins/todos', { services: { auth: fakeAuth } });
try {
  await plugin.execute('add', 'Milk');
  plugin.services.todos.items.state.get().items;
  plugin.events.recorded; // every event emitted while mounted
} finally {
  plugin.stop();
}
```

`mountPlugin(directory, { id, plugins, services, configOverrides })` discovers one folder with
the app conventions (services, actions, events, configs, interceptors, `setup.ts`; files under
`ui/` are skipped), mounts it, awaits `ready` and returns `{ id, runtime, app, actions, services,
events, execute, stop }`. The ID comes from the plugin folder or the nearest `package.json`.
A failed start releases everything and rejects with the attributed error. Files load through
Node's TypeScript type stripping, so keep them free of JSX.

## Navigation boundary

Core does not access browser globals. Mount an ActionList with a navigation callback when
executing navigation actions outside the UI provider (`runtime.actions.mount(navigate)`);
without one, navigation reports an error. The UI ActionProvider supplies browser navigation
by default; the Next and TanStack providers use the application's router.

## Deprecated until Phase 5

These helpers still work and warn once in development: `provideService` (use
`defineService(factory, { provides })`), `defineURLAction` and `defineDialogAction` (use
`defineAction` with `href` or `dialog`), `definePage` and `defineView` (export the component
from `ui/pages` or `ui/slots`), `defineSetup`, `defineServiceInterceptor`, the object form
`defineService({ create, dispose })`, action `resolve` and `watch`, `publicServices`,
`foundation.config.ts`, `foundation-generate`, `withFoundation`, and `@bitakit/next/generated`
(throws with guidance). Run `bitakit migrate` to rewrite a 0.1 project.
