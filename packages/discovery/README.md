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
- `src/modules.mjs`: which folders are plugins.
- `src/watch.mjs`: development regeneration.
- `src/migrate.mjs`: rewrite of a 0.1 project to the current layout.
- `src/host.mjs`: deprecated `generateFoundationHost` alias.

Core's tests cover the generator end to end (`npm test --workspace @bitakit/core`); the package
has no separate test suite.

## License

MIT
