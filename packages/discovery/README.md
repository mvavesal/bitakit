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
  `generateFoundation` and `watchFoundation` around the framework build.
- `@bitakit/cli` uses `generateFoundation`, `watchFoundation`, `describeFoundation`, `describeModule`,
  `loadDiscoveryConfig` and `migrateProject` for `generate`, `info`, `doctor`, `build` and `migrate`.
- `@bitakit/core/testing` (`mountPlugin`) uses `describeModule` to find a plugin folder's files.
- Apps and plugin playgrounds import `defineBitaKit` in `bitakit.config.ts`; generated apps list
  this package as a dev dependency.

`@bitakit/core/discovery` re-exports this package for one release, with `@bitakit/discovery` as an
optional peer dependency of Core. Import `@bitakit/discovery` directly.

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

These safeguards apply to declared package styles and explicit package-owned JS exports
with relative static/literal dynamic imports. Wildcard JS exports, computed imports, external
vendor script graphs and extensionless CSS subpaths are not comprehensively audited; the
remaining graph-validation work is tracked in `REVIEW.md`. They do not sandbox arbitrary
scripts, runtime-created style elements or CSS injected outside this contract.
Doctor checks static root integration; computed cascade correctness is
verified by `scripts/verify-generated.mjs` in clean packed-package consumers.

## Source responsibilities

- `src/index.mjs`, `src/index.d.ts`: the only public entry and its types, including the
  `bitakit.config.ts` options.
- `src/generate.mjs`: configuration loading, framework detection and emission of `src/bitakit.gen.*`.
- `src/entries.mjs`: folder, dotted-name and index-file conventions of contribution files and the
  integration-defined contribution kinds.
- `src/describe.mjs`: read-only summaries of an app (`describeFoundation`) or one module folder
  (`describeModule`).
- `src/packages.mjs`: opt-in metadata (`bitakit` in `package.json`) of installed packages and the
  plugin packages they depend on.
- `src/styles.mjs`: canonical layer prelude, stylesheet resolution and package CSS validation.
- `src/modules.mjs`: which folders are plugins.
- `src/watch.mjs`: development regeneration.
- `src/migrate.mjs`: rewrite of a 0.1 project to the current layout.
- `src/host.mjs`: deprecated `generateFoundationHost` alias.

Generator and stylesheet integration tests live in `packages/next/tests` and the CLI tests.
Run `npm test --workspace @bitakit/next` and `npm test --workspace @bitakit/cli`.

## License

MIT
