# @bitakit/discovery

Node-only BitaKit discovery. It scans an app's `src` and `src/plugins/<id>` folders and the
installed plugin packages, then writes the typed `src/bitakit.gen.*` wiring (provider, config,
`ActionMap`, `ServiceMap`, `EventMap`, `ConfigMap`, `SlotMap` and package styles). It never runs in
the browser and never executes plugin contribution files.

It is its own package so that `typescript` (checks contribution files for a default export) and
`jiti` (loads `bitakit.config.ts` and plugin manifests) stay out of the headless `@bitakit/core`
runtime.

```ts
// bitakit.config.ts
import { defineBitaKit } from '@bitakit/discovery';

export default defineBitaKit({ groups: ['navigation'] });
```

## Who imports it

- `@bitakit/next/config` (`withBitaKit`) and `@bitakit/tanstack/config` (`bitakit()`) run
  `generateBitaKit` and `watchBitaKit` around the framework build.
- `@bitakit/cli` uses `generateBitaKit`, `watchBitaKit`, `describeBitaKit`, `describeModule`,
  `loadDiscoveryConfig` and `migrateProject` for `generate`, `info`, `doctor`, `build` and `migrate`.
- `@bitakit/core/testing` (`mountPlugin`) uses `describeModule` to find a plugin folder's files.
- Apps and plugin playgrounds import `defineBitaKit` in `bitakit.config.ts`; generated apps list
  this package as a dev dependency.

`@bitakit/core/discovery` re-exports this package for one release, with `@bitakit/discovery` as an
optional peer dependency of Core. Import `@bitakit/discovery` directly.

## Trusted lazy package catalog

Set `catalog: ['notes-plugin']` in `defineBitaKit` to include an installed opt-in package in a
lazy catalog instead of the initial plugin array. Discovery emits `packageCatalog` in
`bitakit.gen.config.ts` for framework hosts, or `bitakit.gen.ts` for plain hosts. Each entry
contains its installed version and a `load()` using a literal dynamic import of the public
plugin factory. Contribution types remain available through type-only imports. The provider
module stays component-only. Package CSS remains audited and eager in `bitakit.gen.css`.

Catalog names must identify installed, enabled plugin packages. Packages requiring host config
remain in the startup composition. Runtime plugin dependencies are still explicit: select their
providers too, or keep those providers in the startup composition. A catalog entry does not imply
runtime installation or readiness; static inspection reports its enablement as unknown.

Use the optional [package host adapter](../packages/README.md) to activate an authorized selection.
New code or versions need a new host build. No browser filesystem scanning, remote npm install,
signature verification, sandbox or installation persistence is added by this option.

## Package stylesheet contract

Visual packages export `./package.json` and declare exported CSS in `bitakit.styles`.
Intentional shared theme mappings belong in `bitakit.theme`. Both accept a string or an
array. Preserve those CSS files in `files` and `sideEffects`. Component and plugin JavaScript
must not import CSS, including from lazy chunks. Discovery imports declared styles eagerly
through `bitakit.gen.css`, orders dependencies first and theme mappings last, and emits the
canonical `theme, base, components, utilities` layer prelude. Generated application root CSS
uses the same prelude before Tailwind and the generated import.

Discovery parses the installed CSS import graph and package-owned emitted JavaScript with
PostCSS and TypeScript. It rejects competing layer-order statements, component entries that
contain global resets or shared theme declarations, remote CSS, and JavaScript CSS imports.
The existing Tailwind, HeroUI and animation baselines remain supported. `bitakit build` applies
the same validation after compiling a plugin. Development watches the installed graph; an
invalid update invalidates the generated stylesheet until corrected. Errors identify the
package and file. An opt-in manifest hidden by package exports is diagnosed instead of skipped.

Discovery resolves literal relative and vendor runtime imports (including extensionless CSS
export aliases), and audits every emitted file matching JS wildcard exports. Computed
`import()`/`require()` and unresolved required imports fail with package/file diagnostics.
Missing optional peers remain unavailable until installed; installing them makes their graph
subject to the same audit. Unmodified vendor CSS imports are allowed only when their target
already belongs to the validated eager root stylesheet graph. Plugin-owned JS CSS imports
remain rejected. Explicit `bitakit.theme` entries are trusted theme authority. These checks
are an import contract, not a sandbox for arbitrary scripts, runtime-created style elements
or CSS injected outside this contract.
Doctor checks static root integration; computed cascade correctness is
verified by `scripts/verify-generated.mjs` in clean packed-package consumers.

## Source responsibilities

- `src/index.mjs`, `src/index.d.ts`: the only public entry and its types, including the
  `bitakit.config.ts` options.
- `src/generate.mjs`: configuration loading, framework detection and emission of `src/bitakit.gen.*`.
- `src/entries.mjs`: folder, dotted-name and index-file conventions of contribution files and the
  integration-defined contribution kinds.
- `src/describe.mjs`: read-only summaries of an app (`describeBitaKit`) or one module folder
  (`describeModule`).
- `src/packages.mjs`: opt-in metadata (`bitakit` in `package.json`) of installed packages and the
  plugin packages they depend on, retaining distinct resolved copies.
- `src/package-identity.mjs`: historical build ID prediction and authoritative static binding checks.
- `src/plugin-metadata.mjs`: manifest reads, npm name validation, bundle inputs and Core projection.
- `src/layouts.mjs`: the layout-file convention shared by generation and `describeBitaKit`.
- `src/styles.mjs`: canonical layer prelude, stylesheet resolution and package CSS validation.
- `src/modules.mjs`: which folders are plugins.
- `src/watch.mjs`: development regeneration.
- `src/migrate.mjs`: rewrite of a 0.1 project to the current layout.

Generator and stylesheet integration tests live in `packages/next/tests` and the CLI tests.
Run `npm test --workspace @bitakit/next` and `npm test --workspace @bitakit/cli`.

## License

MIT

#### Additional settings pages

`ui.settings` accepts the existing `{ component }` and optional `pages` entries
`{ id, component, title, path?, category?, order?, description?, icon?, shortcut? }`.
Discovery's `ui/settings/page.tsx` default export may provide the same object. Core keeps
components opaque; the shared UI catalog projects the declarations into settings routes and
navigation. This adds no service registry, value store or host routing code.

Plugin catalog metadata supports optional `tags: readonly string[]` and `coverImage`.
Local plugin manifests use `metadata`; package authors use `bitakit.tags` / `bitakit.coverImage`
in package.json. Existing top-level fields remain fallbacks.
Tags are catalog labels, not access rules. App Preferences derives filter choices from this
metadata and stores the selected tags in the repeated `pluginTag` URL parameters. Missing covers fall
back to the plugin icon.

## Owned slots

`slots/**/*.ts` exports `defineSlot` declarations; `ui/slots/**/*.tsx` still contributes UI.
Both use the existing entry traversal. Dotted files, nested folders and `index.ts` records
resolve to the same IDs. Plugin names are qualified; app names are plain. Generated `SlotMap`
contains the definition types, including payload/data schemas. Legacy name-only declarations
from manifests or `bitakit.config.ts` generate `LegacySlotMap` hints and never replace a contract.

`describeBitaKit` exposes `slotDeclarations` (static hints) and `unresolvedSlots`. It uses
the shared TypeScript-based definition inspection without executing source. Local constant
records and literal IDs are readable; imported/computed records stay unresolved. This is not
runtime validation. A package built with `bitakit build` carries generated `plugin.slots.json`
next to its plugin entry so Doctor can inspect the same hints without importing client code.
Keep the sidecar in the published `dist`; never edit or maintain it separately from source.

Declared `ui/slots` targets use runtime-owned attachment with wait by default. Namespace exports
`id`, `key`, `order` and `availability` are preserved, including through `bitakit build`; the
generated `pluginSlot` call records the source file for attribution. Target definitions and
component files remain separate. Unknown legacy targets are not promoted to declarations.

## Layout families and replaceable parts

Layout files are candidates for the single slot `layout.<family>`: the app's
`src/layouts/<family>.tsx` (key `default`) and `src/layouts/<family>/<variant>.tsx`, and a
plugin's `ui/layouts/...` in the same forms. Generation emits them as `pluginLayout(module,
family, variant, source)` entries in the module's `ui.slots`, and declares app-owned
`layout.<family>` slots (`layoutSlots([...])`) for every family that no installed package
(`*.slots.json`), plugin or app slot file declares. `describeBitaKit` lists them as `layouts`
(`{ family, variant, file }`) per module.

`choose` in `bitakit.config.ts` maps single slots to the candidate the app picks (`'<plugin>'`,
`'<plugin>:<key>'` or `'<key>'`) and is emitted as `choose` in the runtime configuration;
`describeBitaKit` returns it too. A value that is not a non-empty string stops generation.

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
runtime updates keep their owner-specific guarantees. Named components are the supported
React refresh path. Structural provider changes, server code, dependency installation and
changes outside a React refresh boundary can require a host restart/reload. Restart the dev
server after changing Node-loaded generator/integration code. No universal HMR promise.

## Identity and provenance

Discovery binds each definition to its local, included or installed package origin. Package and
bundle identities compare lowercase with complete scopes. Static IDs come only from the selected
manifest block or the entry sidecar; older entries may have unavailable IDs. See the
[identity and metadata reference](../../apps/docs/content/docs/reference/plugin-metadata.mdx)
for canonical fields, membership, passive inspection and compatibility rules. Upgrade Core with
Discovery: generated code uses Core's host provenance API.
