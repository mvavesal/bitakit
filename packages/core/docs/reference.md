# Core reference

## Public app access and installed plugins

Local plugins need only their contribution files:

```text
src/plugins/documents/
  services/documents.ts
  actions/create.ts
```

Each immediate plugin folder supplies its default plugin ID. `plugin.config.ts` is
optional. `defineService({ create: () => ({ ... }) })` infers its public name from the
relative service path; `defineAction({ execute: ({ app }) => ... })` infers its ID
from the plugin ID and action path. Explicit `id` values override these defaults.
Discovery generates registration and types, including service method inputs and outputs.

Use `app.services.documents` and `app.actions.documents.create.execute()`. Action references
delegate to the existing ActionList, preserving execution guards and lifecycle behavior.
Internal actions stay out of enumeration. React ActionButton, ActionBinding and useAction
accept these references; a reference must belong to the same provider's ActionList.

`app.config.<plugin>.<path>` reads the immutable resolved configuration snapshot, including
host overrides. `defineConfig({ defaults: { pageSize: 20 } })` works without a schema;
optional schemas retain their parse contract. Low-level scoped reads remain available through
`runtime.configuration` and the existing action/service config context.
Optional packages can project instance-local facades through `appExtensions` and augment
`AppExtensionMap`. Core owns no Settings implementation or duplicate state.

Service definitions use `exposeAs` to name their existing instance in `app.services`. Public names must be unique within the service namespace. Available since Core 0.1.1.

```ts
const documents = serviceKey<Documents>('editor.documents');
export default function documentsPlugin() {
  return definePlugin({
    id: 'documents',
    services: [provideService(documents, { exposeAs: 'documents', create: () => createDocumentsService() })],
  });
}
```

`runtime.app.services.documents` resolves that same container instance. `defineService` supports the same `exposeAs` option. Discovery defaults it to the explicit ID or relative service path, so normal file-based definitions need neither IDs nor name mappings. Existing `publicServices` remains supported for compatibility and aliases to externally supplied services; it is not a private/public access boundary. Required access reports
FoundationServiceError (`code`, `service`, `reason`, optional `plugin`) when unavailable.
`app.optional.services.documents` returns undefined before mount or when unavailable. After mount,
`app.ready` is true; disposal makes optional reads unavailable again. Obtaining a service
does not subscribe to its data. Existing dependency checks and reverse cleanup still apply.
Do not cache service instances across runtime replacement.

The React hook `useFoundationApp` lives in UI and follows readiness; Core remains usable
without React. Its default public contract is generated from local contributions and installed opt-in plugins.
Manual typed compositions use `FoundationApp<PublicServicesOf<typeof plugins>>` or the
corresponding hook generic. Keep precise factory return types instead of widening them to
`Plugin` if callers need public-service completion.

A package can opt into discovery with public package exports and metadata:

```json
{
  "exports": {
    "./package.json": "./package.json",
    "./foundation": "./dist/foundation.js"
  },
  "foundation": { "plugin": "./foundation" }
}
```

The plugin entry default-exports a synchronous factory returning one Plugin. By default it
receives no arguments. Optional metadata `"configuration": "shell"` passes that path from the
resolved root app config (including defaults and app overrides), or `{}` when absent. It describes services/providers; it must not acquire external resources at factory
time. Core owns their creation and cleanup. Direct dependencies and optionalDependencies
are considered; transitive and development dependencies are not automatically activated.
Only packages exposing their package.json and explicit Foundation metadata participate.
`foundation.config.ts` can disable all package contributions with `packages: false`, or
individual packages with `packages: { 'package-name': false }`.

An optional `foundation.discovery` export default-exports a Node-safe function returning
contribution kind descriptors. Explicit `kinds` overrides replace package defaults by name.
Client plugin factories are never executed by build discovery; these discovery adapters
are trusted build code. Removing/disabling a package removes its generated import and types.
Local source discovery continues through the same existing pipeline.

Source responsibilities: `app/types.ts` owns public typing, `app/access.ts` projects current
services, and `app/service-error.ts` owns diagnostics. `discovery/packages.mjs` reads opt-in
metadata; `discovery/generate.mjs` emits imports and app types. None is a second runtime registry.

Framework-independent Actions, plugin lifecycle and services. React bindings live in the separate @bitakit/ui package. Import general APIs from `@bitakit/core` and UI APIs from `@bitakit/ui`. This package does not create another ActionProvider, settings store, router, authentication session, or API client.

The shared filename grammar, configuration service, migration rules and current limits are documented in [File contributions and config](file-contributions.md).

## Small plugin

```ts
// actions/invite.form-action.ts
import { defineFormAction } from '@bitakit/core';

export default defineFormAction({
  groups: ['userManagement.dropdownMenu'],
  requires: ['users'],
  fields: {
    email: { type: 'email', required: true },
  },
  async submit(values, { services }) {
    return services.users.invite(values);
  },
});
```

File discovery infers `users.invite` from the plugin ID and relative action filename. Standalone React configs supply an explicit `id`, or call `resolveContribution(definition, inferredId)` in their own build integration. No setup file is needed for declarative groups. Groups are created on first use; a central group catalog is optional. Explicit typed ActionGroup objects remain supported. A group does not create UI: bind a menu to its ID.

```tsx
<ActionMenu group="userManagement.dropdownMenu" label="User actions" />
```

Optional `setup` runs after all selected plugins' actions are registered. Its scoped facade tracks registrations and placements; no manual cleanup is required for `getGroup().add()` or `attach()`. It can return cleanup for its own external subscriptions. Async setup is intentionally unsupported. Invalid group IDs, duplicate action IDs and missing/cyclic dependencies fail explicitly. Failed setup rolls back the contributions already installed.

`add()` accepts a core ActionDefinition. Declarative forms/dialogs are supplied in the plugin's `actions` contribution array (or discovered by the Next adapter); use `attach()` for their placements. `attach()` adds a placement without changing the action's global order. Set `order` on the action definition when ordering matters.

## Optional conventions

Explicit properties win over conventions. A definition with `id: 'custom.invite'` keeps that ID even if its file moves. With no `title`, the default key is `<id>.title`; each field uses `<id>.fields.<name>`. `title`, `description` and field `label` accept a translation key when present in the current catalog, otherwise literal text. There are no separate action key properties. Button, menu, dialog heading and submit button read the same action title; the dialog reads its action description. Missing labels fall back to a readable ID/field name. Supply a translator with `has(key)` (such as next-intl's translator) to avoid querying missing keys.

`success` and `failure` each accept a literal string, `{ messageKey, values? }`, `{ message }`, a synchronous callback returning any of these, or `false`. Absent feedback, `false`, empty messages and callback `undefined` are silent. Success callbacks receive `{ result, input, services }`; failure callbacks receive `{ error, input, services }`. Results retain the inferred return type of `submit`/`execute`; errors are `unknown` and should be narrowed before use. Feedback callbacks are for presentation and cannot reverse an already completed operation if they throw.

There are no inferred outcome messages. Explicit `messageKey` and `values` use the current translator; literal strings remain literal. Raw errors are never used as display text.

```ts
success: ({ result }) => ({
  messageKey: 'users.invite.created',
  values: { invitationId: result.invitationId },
}),
failure: ({ error }) => error instanceof InviteLimitError
  ? { messageKey: 'users.invite.limit' }
  : undefined, // default failure text
```

`success: false` hides the success message; forms still close. Set `closeOnSuccess: false` to keep the form open. Existing `{ closeDialog: false, messageKey: '...' }` feedback is also supported; `closeOnSuccess` wins when both are supplied. `failure: false` leaves a failed form open silently. Opening a form/dialog never displays a success message. Commands report through the provider's `notify`; forms do so on the normal submission path, including custom render's `submit` function. The low-level `<id>.submit` action is an internal execution primitive; programmatic consumers should use `runtime.submitForm(runtime.getSnapshot().definition, values)` for the full form flow.

Set `conventions: false` on an action to require explicit ID/title and disable inferred field keys. Explicit messages and groups still work. The Next discovery config offers the same switch globally; an action can override it. Core actions registered directly in the ActionList remain unchanged.

Command failures throw `ActionFailure`: `feedback` contains the selected string or `false`, and `cause` retains the original error. The runtime observes failed execution once and sends explicit feedback to `notify(message, kind)`, where kind is `success` or `failure`. Do not toast the same `ActionFailure` again in `onError`. Form failures also retain their inline feedback. The notifier may return a promise; throws and rejections cannot change execution outcomes. `setNotifier` returns owner-safe cleanup. No parallel execution or notification registry is introduced.

## Host integration

FoundationProvider owns the root ActionProvider or reuses an existing outer provider. Supply stable `config`, `ui`, `translate`, localized `labels`, and an optional outcome-aware `notify(message, kind)` callback to the generic UI entry. The Next adapter provides standard UI, labels and navigation defaults. The package owns form state, validation, pending/error behavior and lifecycle.

A standalone React application can supply an explicit `FoundationConfig`; Next is not required. The provider owns no global singleton. Services are created on mount, in dependency order, and disposed in reverse order. Their optional `dispose(instance)` handles external resources. Locale changes update presentation through the original registrations without recreating services or pending actions. Changing the config object replaces that plugin composition deliberately.

Form actions register the public opening action and an `<id>.submit` registration flagged `internal`: it stays executable so interceptors, pending state and execution events apply, but `useActions()` and group views hide it. Both use the existing execution engine. Submission validates required/text/email/select fields even if invoked programmatically; the form maintains drafts on failures. Disable/hide checks apply again at execution. Closing is blocked during a pending submission. Only one foundation dialog is open at a time. `render` can override the form body using `values`, `setValue`, `submit`, `pending`, `enabled`, and `error`. `defineDialogAction` provides a custom body without form submission machinery.

`ActionBoundary` gates children on current action visibility/enabled state, fails closed for missing actions, and accepts a fallback. It is a UI gate, never a substitute for server authorization. Hiding/unmounting children discards their local React state.

## Types and translation

Core discovery generates a `ConfigMap` for module config and a `ServiceMap` augmentation using each service factory's return type, and an `ActionMap` augmentation from discovered action definitions: the effective ID (`replaces`, then an explicit `id`, then the file path) maps to the definition's input and result types, so `useAction`, `list.execute` and the UI bindings autocomplete IDs and type their input and completed `value`. Class and function exports establish their ID at construction and are excluded; augment `ActionMap` manually for those. With global `conventions: false` only explicit IDs are emitted. Unknown IDs remain allowed unless `ActionMapOptions` is augmented with `{ strict: true }`. Explicit consumers may augment `@bitakit/core` themselves. `requires` declares runtime dependencies; TypeScript provides method input/output inference. API responses still need runtime validation in the service.

`mergePluginMessages` merges each key in this priority: app current language, plugin current language, app fallback language, plugin fallback language (highest priority first). Packaged catalogs are exported by their owning package; local discovery catalogs retain their plugin namespace. Pass the result to your normal translation provider. The package does not create a second locale store.

## Scope

Implemented: local trusted plugins, synchronous typed service factories, actions/forms/dialogs, scoped group placement, lifecycle, translation composition and UI boundaries. Existing SettingsCatalog contributions continue through the settings package; there is no parallel settings loader. Remote plugin installation, untrusted code sandboxes, server frameworks and database migrations are not included in Core. Next.js and experimental TanStack integrations live in separate packages.

### Shared unavailable message

```tsx
const access = defineAction({
  id: 'users.access',
  title: 'users.title',
  enabled: false,
  unavailable: { messageKey: 'users.unavailable' },
});
// Supply once as a plugin contribution to the shared host list.
<ActionBoundary action="users.access">
  <UserPage />
</ActionBoundary>;
```

A disabled boundary uses the action's localized unavailable message by default. A custom `fallback` may be content or `(message) => ReactNode`. Unknown actions remain blocked. Core treats metadata as opaque; React rendering belongs to `@bitakit/ui`.

## Discovery and explicit composition

`@bitakit/core/discovery` is a Node-only build entry point. It scans files and emits imports; the browser provider never reads the filesystem. Adapters call `generateFoundation(root)` initially and `watchFoundation(root)` during development. Next integration is a separate package. Production changes require rebuilding and deployment.

The generated config and the optional `FoundationProvider` props `actions`, `plugins`, `interceptors`, and `providers` follow one selection rule:

- Omitted: inherit the generated configuration.
- Explicit array: replace that domain.
- Empty array: select none.

An explicit `actions` array replaces all declarative Actions, including selected plugins' Action contributions. Those plugins' services and setup still run; imperative registrations made by setup or the public API remain explicitly owned by their caller. A setup that requires an excluded Action must be adjusted as well. `plugins=[]` excludes plugins but retains independent app Actions.

```tsx
// Pseudocode: keep configuration and these arrays stable across renders.
<FoundationProvider
  config={discovered}
  interceptors={[confirmation, audit]}
  providers={[theme, widgets]}
  ui={ui}
  translate={translate}
  labels={labels}
>
  <App />
</FoundationProvider>
```

Interceptors execute in ascending `order`, preserving registration order for ties. App discovery activates discovered interceptors by default; an explicit `enabled` list selects them (an empty list disables them). Plugin interceptors are local unless marked `scope: 'global'`; host interceptors remain global by default. React providers still require an explicit ordered `enabled` list. The shared file grammar accepts flat, directory and legacy suffix forms. Direct interceptor instances and `defineInterceptor({ requires, create })` factories are supported. The Foundation owns only its registrations; manually installed low-level ActionProvider interceptors are independent and are not removed by a Foundation override.

React providers use `defineProvider({ id, component, requires })`. The first entry wraps the others. Required providers must appear earlier; duplicate IDs and missing or reversed dependencies fail before mounting. These wrappers live inside the Foundation context, including its dialog host. They do not replace the host's root authentication or Settings providers.

Host services supplied through `services` retain host ownership. Plugin-created services and interceptor registrations are cleaned up with the runtime. Keep service objects and explicit arrays stable; replacing their identity deliberately replaces the runtime composition. Translation changes alone preserve the ActionList, mounted services and pending actions.

`actionOverrides` can cap an Action's `enabled` or `visible` state by final ID. A false cap cannot be bypassed by a reactive subscription; true does not bypass business guards or permissions. This affects UI availability, not server authorization.

## Direct Action exports

An Action file can default-export an `Action` subclass directly. No registration wrapper or separate factory builder is required. The runtime constructs a fresh instance per runtime, reads its metadata, translates its title and owns its connection lifetime. Its explicit ID wins over the inferred file ID.

```ts
export default class Logout extends Action {
  constructor() {
    super({ title: 'Nav.logout' });
  }
  async execute() {
    await logout();
  }
}
```

For Action dependencies, export a function receiving the typed `ActionEnvironment` (`services`, `translate`, `config`) and returning an Action. The same context is passed to class constructors that need it. Constructors/functions should only create instances; put subscriptions in `connect()` so the ActionList owns cleanup. Discovery does not execute these exports. Plain, form and dialog definitions remain supported. Do not export mutable singleton Action instances.

`execute(input, context)` receives the invocation context as its second argument, and its return value becomes the completed result's `value`. A class may declare `success` and `failure` feedback fields; they run through the same translated feedback pipeline as declarative definitions. Without them, class actions keep raw errors and stay silent, so navigation and setting bindings never toast by accident.

## Runtime structure

Every contribution kind (plain command, form, dialog, class export) is normalized by an adapter in `src/contributions` into registrations plus the services it requires or watches. The runtime only orders plugins, creates services, registers the adapted entries, subscribes to watched services and re-translates registrations on locale changes. Add a new contribution kind by adding an adapter, not by extending the mount sequence.

## Integration contributions

Optional integrations add declarative contribution kinds without teaching Core their meaning. A
module lists values under `contributions: { [kind]: values }`; exactly one module claims each kind
with `installs: { [kind]: (values, { module, app, services }) => cleanup }`. During mount the
runtime installs contributions after services, translation and interceptors and before actions and
setup, kind by kind in module dependency order. The cleanup belongs to the contributing module's
scope. A contributed kind without an installer, or a kind claimed twice, fails the mount.
Integrations type their kinds by augmenting `ContributionMap`.

`runtime.contributionsOf(kind)` returns the same values in install order without mounting, so a UI
integration can prepare an initial render snapshot that equals the mounted state.
`scopeModule(scope)` identifies the module of a runtime-issued `PluginScope` (the scope passed to
`setup`); integrations use it to derive ownership instead of trusting caller-supplied owner strings.

Discovery supports integration kinds in `foundation.config.ts`:

```ts
export default defineFoundation({
  kinds: [
    {
      name: 'settings.renderers',
      directory: 'renderers',
      from: '@bitakit/app-preferences/foundation',
      normalize: 'discoverSettingsRenderers',
    },
  ],
});
```

Each kind names the folder that identifies it inside every module root and the normalizer to
import. Generation emits `contributions: { 'settings.renderers': normalize([files], moduleId) }` for
the app and each enabled plugin; it never executes the files. Folders cannot collide with built-in
kinds or each other, and a plugin manifest can override a kind's folder through `entries`.

## Provider plugins and typed services

Provider adapters live in separate packages: `@bitakit/better-auth` and
`@bitakit/next-intl`. They return ordinary plugins. Pass them through `plugins`;
there is no separate integration lifecycle or configuration list. Core has no vendor imports.
Plugins may contribute services and ordered providers as well as actions, pages and views.
Use `serviceKey<T>`, `provideService` and `getService` to preserve input/output types without
pretending that an optional provider is always installed. See the owning integration package README for its setup.

Plain Actions can declare `watch: ['auth']` and derive contextual presentation with `resolve(input, { services })`. The runtime validates the observable service, subscribes once per service (even for multiple Actions), refreshes the shared ActionList on changes and owns cleanup. There is no copied session state and no Action-level subscription boilerplate. `requires` remains useful for non-observable dependencies.

### UI styles

Core ships no UI stylesheet. React bindings and visual package styles belong to their respective packages.

Core has no React dependencies or renderer source files. Presentation values are opaque host extension types. The backend runtime does not require the UI package. See the headless-boundary regression test.

## Typed custom Action state

```ts
// src/plugins/documents/actions/save.ts
export default defineAction<{ title: string }>()({
  initialState: { savedCount: 0, lastTitle: '' },
  async execute(input) {
    const document = await this.app.services.documents.save(input.title);
    this.state.update((current) => ({
      savedCount: current.savedCount + 1,
      lastTitle: document.title,
    }));
    return document;
  },
});
```

Use method syntax for execute; arrow functions do not receive the bound `this`.
Input is explicit; state and result types are inferred and included in discovery's ActionMap.
The original defineAction({...}) context-based API remains available. Keep definitions in
contribution files and consumers in their own modules. A same-module app lookup preceding
its own inferred definition can cause a TypeScript augmentation cycle, including with the
original API; avoid that self-reference or supply an explicit definition type.

`this.app`, `this.services` and `this.config` use the existing execution context.
`this.state.get()` reads current state; `this.state.update(updater)` publishes through the
existing ActionList. State starts as a structured clone of initialState for each registration;
use cloneable values and immutable updates. It is shared by bindings to that registration,
not persisted across unregistration or reload. Input and return values are not stored as state.
Late updates from a removed or replaced registration return false.

Core exports ActionStatus.Idle, Pending, Succeeded and Failed. Snapshots expose status and
error; the executor owns both. The existing pending guard prevents concurrent execution of
the same registration. Skipped calls preserve the previous status/error (an intercepted call
may temporarily enter Pending). ExecutionResult retains its completed/skipped contract, and
failed executions still reject. A successful retry clears the error.

Source responsibilities: actions/state.ts owns lifecycle names and mapped state types;
contributions/stateful-action.ts adapts instance-style authoring. ActionList remains the sole
snapshot store, and actions/execution.ts owns lifecycle transitions.

## Mixed interceptor files

Both interceptor kinds share `interceptors/`. Subfolders and dotted filenames organize entries;
the helper's discriminator decides the kind. Default-export a single definition, a named object
collection, or an array (including collections containing arrays).

```ts
// src/plugins/documents/interceptors/logging.ts
import { defineActionInterceptor, defineServiceInterceptor } from '@bitakit/core';

export default [
  defineActionInterceptor({
    before() {
      console.log('Action started');
    },
  }),
  defineServiceInterceptor({
    service: 'documents',
    method: 'save',
    before({ args }) {
      console.log(args[0]);
    },
    after({ result }) {
      console.log(result.title);
    },
    onError({ error }) {
      console.error(error);
    },
  }),
];
```

Omit `method` to observe all public string-named methods of the selected service. Service names
resolve through public service aliases or raw container keys. Known service methods infer argument
and awaited result types. Action interceptors retain existing plugin/global scope and cancellation;
`defineInterceptor` remains the legacy Action helper. Service observers explicitly target a service,
independently of the organizing folder. `order` sorts observers ascending with stable ties.

Service hooks are observation-only. Return values are ignored, callback failures are isolated, and
callbacks are not awaited. Do not mutate observed arguments or results. Business methods retain
synchronous return behavior, original Promises and original errors. The wrapper binds methods and
getters to their original instance, preserving private fields. Internal self-calls and calls through
an original reference outside the container bypass observation. Symbol methods and constructors
are not observed. The method facade supports ordinary object/class services, including frozen
objects; it is not a general-purpose transparent reflection or callable-function proxy.

Every container consumer, including dependent service factories and Actions, sees the same wrapped
instance. Disposal disables callbacks, including settlement of an already-running call, and still
cleans up the original service instance. No second service registry is introduced.

Source responsibilities: `interceptors/service.ts` contains definitions and inferred contracts;
`interceptors/service-observers.ts` wraps method access. `services.ts` owns construction/disposal,
and runtime routes Action definitions to the existing Action interception pipeline.

### Declarative keyboard metadata

`shortcut: { keys: 'Mod+Shift+S' }` declares a keyboard binding without DOM or vendor imports in Core.
Commands with a required typed input must supply `shortcut.input` of that type; the adapter never
infers input from focused controls or a last-clicked row. Class Actions, commands and form/dialog
openers retain this metadata. Internal form-submit registrations are excluded. Browser handling
belongs to UI's existing ActionProvider; see its README for scopes and collision behavior.

## Navigation boundary

Core does not access browser globals for navigation. Mount an ActionList with an explicit
navigation callback when executing URL Actions outside the UI provider. Without a navigation
host, URL execution reports an error. The UI ActionProvider supplies browser navigation by
default; the optional Next and TanStack providers use the application's existing router.

## Runtime events and action setup

See [Events and action setup](events.md) for the built-in runtime-local event bus,
`defineAction({ setup })`, scoped `events.watch`, payload typing and async semantics.
Existing definition-level `watch: ['serviceId']` and `resolve` retain their service
observation and execution-time presentation behavior.
