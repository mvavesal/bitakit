# @bitakit/packages — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/packages`).
> To change the package itself, follow the repository's own AGENTS.md instead.

An optional host adapter that activates trusted, build-included plugin packages at runtime
(for example per tenant or per preview session). The root entry has no React or Node imports; Core keeps ownership, dependencies, cleanup and
readiness. Optional browser/server entries add artifact delivery, npm installation and a journal.

## Use it

1. Install the plugin package and list it in `bitakit.config.ts`: `catalog: ['notes-plugin']`.
   Discovery then emits `packageCatalog` in `src/bitakit.gen.config.ts` and leaves the package
   out of the initial composition.
2. In host management code (not in plugin hooks, Actions or disposers):

```ts
import { createPackageHost } from '@bitakit/packages';
import { packageCatalog } from './bitakit.gen.config';

await runtime.ready;
const packages = createPackageHost({ runtime, catalog: packageCatalog });
await packages.reconcile({
  scope: 'tenant-42',
  packages: [{ name: 'notes-plugin', version: packageCatalog['notes-plugin'].version }],
});
```

## Rules

- `reconcile` takes an already-authorized selection: the server decides which packages a scope
  may enable; a client scope string proves nothing.
- One adapter per runtime; do not change the same plugins through Core directly as well.
- Catalog mode loads trusted, build-included packages. Dynamic mode is a separate explicit opt-in.

## Identity checks

Catalog names and requested names compare lowercase, preserving full npm scopes. Duplicate
canonical catalog keys fail. An optional `pluginIds` array declares the complete static set:
collisions are rejected before new loaders run, and loaded IDs must match. Omit it when a
legacy loader's set is unknown. Multi-plugin loaders still work; each definition receives its
own package binding. Provenance supplied by a generated loader is retained.

## Dynamic mode

Use the existing `createPackageHost({ runtime, dynamic })`, not a second runtime or registry.
`dynamic` supplies a `PackageProvider`, a durable `PackageJournal`, `dataCompatibility:
'unchanged'` and optionally an awaited `health(ids)` callback. Call `recover()` before reconciling
persisted selections; retain artifact IDs in every saved selection. Use one coordinator/session
per journal key. Keep management outside owned lifecycle work and health callbacks.

- `@bitakit/packages/server` (Node 24+) uses npm, esbuild, Rollup and Discovery. Install its optional
  peer toolchain in the privileged host; never import it in React/Core/browser code. Source
  authorization, npm credentials and transport belong to the host. No public install endpoint.
- `createPackageInstaller({ directory, shared, registry? }).install(spec, { entry?, pluginIds?,
signal? })` prepares immutable artifacts. Scripts stay disabled. Source entries export normal
  zero-argument factories; built packages use the existing export and static ID sidecar. The full
  multi-plugin ID set is required. Use actual host versions in `shared`.
- `createBrowserPackageProvider` binds actual module namespaces via a host-supplied SystemJS
  instance. Its resolver returns an authorized artifact and immutable directory URL. Bind every
  required shared subpath, configure CSP/CORS, and use host health evidence for UI readiness.
- Known ID/peer/import/CSS/preflight failures keep the old generation. Startup/health failures
  recover the prior cohort; failed cleanup/recovery remains blocked with retained intent.
- SQLite journals use compare-and-swap. There is no multi-client rollout, automatic GC, schema
  migration or arbitrary data snapshot. Never describe code rollback as database restoration.
- Serve declared artifact files only; private installation evidence contains lock/source details.
  Keep active, previous and unfinished-recovery artifacts. Read README for limits and transport.

On session shutdown, await `packages.dispose()` outside owned work (or after a successful
`runtime.stop()`). This releases browser resources and preserves durable selection for recovery;
reconciling an empty selection is an explicit uninstall. Failed cleanup blocks reuse.
