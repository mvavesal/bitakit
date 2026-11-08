# @bitakit/core — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/core`). To
> change the package itself, follow the repository's own AGENTS.md instead.

The framework-independent runtime: plugins, services, Actions, events, settings, slots,
interceptors and configuration. It has no React; React bindings are in `@bitakit/ui`. Apps
rarely call the runtime directly: files in `src/plugins/<id>/` are discovered, and the
`bitakit-app-development` skill has a recipe for each kind.

## The define helpers (import from `@bitakit/core`)

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

## Rules

- One `defineAction` shape; state belongs in a service `store()`, replaced with `state.set`.
- Reading a missing service throws; list other plugins' services in `requires`, or check
  `app.has(name)` for optional ones.
- Only the declaring plugin emits its events; others listen.
- `enabled`, `visible` and interceptors are client rules; authorize on the server.

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
The optional `@bitakit/core/testing` entry requires Discovery 0.2.5 or later.

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
