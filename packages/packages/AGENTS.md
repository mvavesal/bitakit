# @bitakit/packages — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/packages`).
> To change the package itself, follow the repository's own AGENTS.md instead.

An optional host adapter that activates trusted, build-included plugin packages at runtime
(for example per tenant or per preview session). It has no React, no installer and no
installation database; Core keeps ownership, dependencies, cleanup and readiness.

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
- Only trusted, build-included packages: nothing is downloaded at runtime.
