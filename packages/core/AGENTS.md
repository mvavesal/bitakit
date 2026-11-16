# @bitakit/core — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/core`). To
> change the package itself, follow the repository's own AGENTS.md instead.

The framework-independent runtime: plugins, services, Actions, events, settings, slots,
interceptors and configuration. It has no React; React bindings are in `@bitakit/ui`. Apps
rarely call the runtime directly: files in `src/plugins/<id>/` are discovered, and the
`bitakit-app-development` skill has a recipe for each kind.

## The define helpers (import from `@bitakit/core`)

Files under `server/` import the same helpers from `@bitakit/core/server` (see below).

| File (in a plugin)       | Helper                                                         | ID                 |
| ------------------------ | -------------------------------------------------------------- | ------------------ |
| `services/<name>.ts`     | `defineService(({ store, events, settings, onStart }) => ...)` | `<plugin>.<name>`  |
| `actions/<name>.ts`      | `defineAction({ title, enabled, execute, ... })`               | `<plugin>.<name>`  |
| `events.ts`              | `defineEvents({ changed: event<T>() })`                        | `<plugin>.changed` |
| `settings.ts`            | `defineSettings({ name: setting({ default }) }, page)`         | `<plugin>.<name>`  |
| `permissions.ts`         | `definePermissions({ content: ['read', 'edit'] })`             | `<resource>`       |
| `slots/<name>.ts`        | `defineSlot({ accepts, policy?, payload? })`                   | `<plugin>.<name>`  |
| `interceptors/<name>.ts` | `defineInterceptor({ action or service, before, after })`      | —                  |
| `configs/<name>.ts`      | `defineConfig({ defaults, schema? })`                          | `<plugin>.<name>`  |
| `setup.ts`               | `Setup` function (`scope.slots.attach`, cleanup)               | —                  |

The app declares its base roles once in `src/roles.ts` with `defineRoles({ ... }, { customRoles })`.

## The server half (`@bitakit/core/server`)

A plugin's `server/` folder runs only on the server and is never bundled for the browser.

| File (in a plugin)              | Helper (from `@bitakit/core/server`)                           | ID                                    |
| ------------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| `server/actions/<name>.ts`      | `defineAction({ access, expose?, input?, output?, execute })`  | `<plugin>.<name>`, `server:` in tools |
| `server/services/<name>.ts`     | `defineService(() => ...)`: one instance for the whole process | `<plugin>.<name>` (server services)   |
| `server/interceptors/<name>.ts` | `defineInterceptor({ action: '<plugin>.*', before, after })`   | —                                     |
| `server/contributions/<dir>/…`  | Files of a contribution kind declared with `runtime: 'server'` | —                                     |

- `access` is required: `'public'`, `'user'`, `'organization'` or
  `{ permission: { resource: ['operation'] } }`. `expose: true` publishes the operation over
  HTTP and in the client's typed `remote` (`remote.<plugin>.<name>(input)` in client Actions
  and services); without it the operation is callable only in-process (`server.as(request)`).
- `execute({ id, input, ctx, services, config, events, settings, signal })`: `ctx` is the frozen,
  verified identity (`requestId`, `signal`, plus `user`, `organization`, `member`, `can()` by
  access). Filter every query by `ctx.user.id` or `ctx.organization.id`; server services take
  `ctx` or the owner ID as a method argument and never hold per-user state.
- Identity comes from one app service with `provides: requestContext` (`resolve(request)` →
  `{ user, organization?, member?, reason?, can? }`). It returns an organization only for a
  verified, active membership; `can` grants only by answering exactly `true`. Without a provider
  the server refuses to start while a non-public operation exists.
- Throw `OperationError(code, safeMessage, { issues?, reason? })` for expected failures (codes
  `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TOO_MANY_REQUESTS`, ...);
  anything else answers 500 with a `requestId` and is logged. `remote` rejects with the same
  `OperationError` (also exported from `@bitakit/core`, with `isOperationError`), and an Action's
  default failure message shows its `safeMessage`.
- On the server, settings load per request: `await settings.<plugin>.<name>.load()` (in an
  operation; `load(ctx)` elsewhere) through a `settings.storage` provider; `get()` throws.
  `store()` is process-wide. Events reach in-process listeners with `{ signal, ctx }` and never
  the browser. Interceptor `before` sees validated input; returning `false` rejects the call
  (`FORBIDDEN`, reason `INTERCEPTED`). Client interceptors never match server Actions.
- The route: `export const POST = fetchHandler(server)` with `server` from the generated
  `src/bitakit.gen.server.ts` (Next.js: `src/app/api/rpc/[...path]/route.ts`). It accepts only
  `POST <endpoint>/<operation id>` with JSON from the app's origin (`trustedOrigins` for exact
  others), up to 1 MiB; `server.endpoint` (default `/api/rpc`) comes from `bitakit.config.ts`
  `server.endpoint`.
- Reserved name segments (`then`, `catch`, `finally`, `subscribe`, `toJSON`, `valueOf`,
  `toString`, `constructor`, `prototype`) cannot name a server Action.

## Roles and permissions

- Core holds only the vocabulary: `definePermissions`, `defineRoles`, the composed catalog and
  its checks. It stores nothing and authorizes nothing; the authorization provider (for example
  the Better Auth adapter) translates the declarations and decides every check on the server.
- A plugin declares the resources and operations it owns, never roles. One resource has one
  owning plugin.
- Only the app declares base roles (`src/roles.ts`): `standard` extends the provider's built-in
  `owner`, `admin` or `member`; `label` and `description` are defaults that translations
  override; `grants` lists operations from the catalog (typed by `bitakit generate`). Declaration
  order is display order, never a permission hierarchy.
- `bitakit generate` writes `bitakit.gen.access.ts` with the composed `accessConfiguration`
  (server-safe data) for authorization adapters.
- Conflicts fail before the app runs, at generation and again at startup: a resource claimed
  twice, a grant of an unknown resource or operation, a standard role extended twice, roles in a
  plugin. Nothing is resolved by registration order or merging.

## Slots and replaceable parts

- `policy: 'list'` (default): every contribution renders. `'keyed'`: outlets pick one by key.
- `policy: 'single'`: a replaceable part. Several plugins may offer a candidate; one renders:
  the app's `choose` entry in `bitakit.config.ts`, else the app's own contribution, else the
  only candidate; a tie renders the owner's default. `selectSingle(candidates, { choice, appId })`
  is the rule, exported for tools.
- Layout families are `single` slots named `layout.<family>`; screens such as
  `screen.not-found` are `single` slots too.

## Testing

`mountPlugin(folder, { plugins, services })` from `@bitakit/core/testing` discovers and starts
one plugin under Node (no browser); `plugin.execute(id, input)` resolves to the outcome
(`completed` or `skipped`) and rejects on failure; `plugin.events.recorded` lists emitted events.

`mountServer(folder, { plugins?, services?, configOverrides?, kinds?, app? })` boots a folder's
server half (shared files plus `server/`, loaded with the app's tsconfig `paths`);
`mounted.as(identity({ user, organization, member, permissions, reason }))` calls every
operation, also private ones, with the same checks as over HTTP. A test `requestContext`
provider answers it and replaces the folder's own. Test each exposed operation as a member, a
member of another organization and signed out (`user: null`). `mountPlugin(folder, { remote })`
connects a client half to `mounted.as(...)` or a stub. `mountServer` needs
`@bitakit/discovery` 0.3.1 or later.

## Rules

- One `defineAction` shape; state belongs in a service `store()`, replaced with `state.set`.
- Reading a missing service throws; list other plugins' services in `requires`, or check
  `app.has(name)` for optional ones.
- Only the declaring plugin emits its events; others listen.
- `enabled`, `visible` and interceptors are client rules; authorize in the server operation's
  `access` and filter its data by `ctx`.
- Browser code never imports `server/` files, `@bitakit/core/server` or
  `src/bitakit.gen.server.ts`; server code never imports React or `ui/` (`bitakit doctor` checks).

## Identifier compatibility and integration contexts

Registered spellings and exact matches remain authoritative, including existing case-only
names. Service/contract lookup, declared events, Actions, plugin references and dependencies
also accept an unambiguous case-insensitive match. An ambiguous non-exact reference throws;
use an existing exact spelling. Generated map keys and namespace property types preserve
original spellings. String-based Action/event/service hooks resolve mixed case with payload
checking. Undeclared event strings retain their existing open-bus semantics; declare events
for a typed, resolvable public name. Filesystem paths, URLs and service method names are unchanged.

Optional integrations reuse `expandContributions` for folder/dotted/record declarations.
`ContributionInstallerContext` describes the full contributing owner context (config, events and
settings) supplied by the runtime. Installer callbacks retain `ContributionContext`, where these
fields are optional for legacy direct invocations. Installed cleanup
belongs to the contributor. Do not introduce a parallel context, registry or event bus.

Service interceptors receive `callId` and epoch `startedAt`, plus `durationMs` on completion or
failure (optional in the types for legacy manually constructed calls). Async settlement is observed without replacing the original promise or awaiting the
observer. These IDs are local to one runtime. Trusted observers may see arguments/results;
public inventory does not. Self-calls still bypass the service proxy; a producer that promises
observable execution must enter its public method through the service container.

## Plugin identity and inspection

Discovery records provenance on definitions. `withPluginOrigin(plugin, record)` is the trusted
host API; `getPluginOrigin` reads it. Replacing a definition without a record leaves it unknown.
`pluginMembership` and `groupPlugins` are pure grouping projections; membership never changes
execution or access. `inspectRuntime` adds origin, package, parent and membership to its existing
version-1 inventory. Package/bundle names compare lowercase with scopes preserved; runtime IDs
stay unchanged. `projectPluginMetadata` shares canonical-first package metadata and legacy
fallback; `projectPluginMetadataSources([{ value, location }, ...])` uses the same projection
with ordered sources and diagnostic labels. `packageMetadataSources` extracts public package
fields without I/O. Included folder bindings preserve existing plugin metadata before package
fallbacks. `metadata.name` remains supported; package identity is recorded independently.
`pluginDisplayTitle(metadata, fallback?)` shares title-before-name selection; consumers apply
translations and explicit settings section labels first. `projectPluginMetadataSources` accepts
`{ packageName }` to distinguish the generated identity fallback from an authored display name.
Origin records may carry `metadataLocation` for diagnostics. Rebinding a definition retains
existing `metadataWarnings`. The runtime's application module has local origin; unknown
replacement plugins remain unknown. Static inventory may include `selected` and
`diagnostics.identityConflicts`; physical record keys are not portable package identities.
The optional `@bitakit/core/testing` entry requires Discovery 0.2.5 or later; `mountServer`
needs 0.3.1 or later.

### Complete cohort replacement

Host-only `runtime.plugins.replace(ids, nextPlugins, { expectedRevision?, preserve? })` validates
an entire proposed composition before stopping any old owner. `plugins.preview({ operation:
'replace', ids, plugins, ...options })` uses the same planner. Supply every owned descendant;
external dependents and outside ID collisions are refused. Empty old/new sets support addition
or removal. Providers, foundational services and other composition restrictions still return
`restart-required`. Cleanup is awaited; failed cleanup blocks reuse. A startup failure can leave
candidate definitions installed with failed lifecycle state; this API does not silently roll
back. Optional `@bitakit/packages` coordinates artifact recovery. Core never downloads or
persists code, and `reconcilePlugins` retains its existing narrower compatibility contract.
