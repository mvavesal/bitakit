<p align="center">
  <img src="https://raw.githubusercontent.com/mvavesal/bitakit/main/docs/assets/readme/bitakit-banner.png" alt="BitaKit — Your app. Your building blocks. An AI-friendly composition layer for modern applications." width="1024">
</p>

# BitaKit Core

Framework-independent plugins, services, Actions, events, settings and lifecycle management.
Core works in Node.js and the browser without React or a router. Its `@bitakit/core/server`
entry runs plugins' server halves. React bindings, discovery, visual plugins and provider
integrations are separate packages.

## Install

```sh
npm install @bitakit/core
```

For a new application, `npx @bitakit/create-app my-app` connects the packages for you
(Node.js 24 or newer). The handbook describes the 0.3 API in this checkout; use matching
package versions or the [local package workflow](../../apps/docs/content/docs/local-development.mdx)
when trying unpublished changes.

## Start with one service

In a discovery-enabled app, create `src/plugins/counter/services/value.ts`:

```ts
import { defineService } from '@bitakit/core';

export default defineService(({ store }) => {
  const state = store({ count: 0 });
  return { state, increment: () => state.set((s) => ({ count: s.count + 1 })) };
});
```

Discovery names it `counter.value`. Continue with the
[Counter learning path](../../apps/docs/content/docs/concepts/index.mdx)
to add an Action and a page. Installing Core alone does not scan folders or render UI.
For a headless program, follow [manual composition](../../apps/docs/content/docs/concepts/manual-composition.mdx).

## The server half

A plugin's `server/` folder holds code that runs only on the server. An operation is a server
Action, written with the same `defineAction` imported from `@bitakit/core/server`:

```ts
// src/plugins/counter/server/actions/save.ts
import { defineAction } from '@bitakit/core/server';
import { z } from 'zod';

export default defineAction({
  access: 'user', // required: 'public', 'user', 'organization' or { permission }
  expose: true, // callable from the browser as remote.counter.save(input)
  input: z.object({ count: z.number().int() }),
  execute: ({ input, ctx }) => ({ userId: ctx.user.id, count: input.count }),
});
```

Discovery writes `src/bitakit.gen.server.ts`; one route serves every exposed operation
(`export const POST = fetchHandler(server)`), and client Actions and services call them through
the typed `remote`. Identity comes from one app service with `provides: requestContext`.
`@bitakit/core/testing` boots a server half with `mountServer` and calls it as different people
with `identity(...)`. See [The server half](../../apps/docs/content/docs/concepts/server.mdx)
and the [Server reference](../../apps/docs/content/docs/reference/server.mdx).

## Developer handbook

The handbook is maintained once in the documentation website's source. The links below
resolve within a repository checkout and follow the branch viewed on GitHub. Run
`npm run dev:docs` from the repository root to read the rendered handbook at
`http://localhost:3002/docs`. A public documentation address is not configured yet.

| Topic                                     | Guide                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Services and cleanup                      | [Service reference](../../apps/docs/content/docs/reference/services.mdx)                                                                   |
| Actions and React bindings                | [Action reference](../../apps/docs/content/docs/reference/actions.mdx)                                                                     |
| Events and interception                   | [Events](../../apps/docs/content/docs/concepts/events.mdx), [Interceptors](../../apps/docs/content/docs/concepts/interceptors.mdx)         |
| Files and developer configuration         | [Discovery](../../apps/docs/content/docs/concepts/discovery.mdx), [Configuration](../../apps/docs/content/docs/concepts/configuration.mdx) |
| Extension points and preferences          | [Slots](../../apps/docs/content/docs/reference/slots.mdx), [Settings](../../apps/docs/content/docs/reference/settings.mdx)                 |
| Runtime updates and diagnostics           | [Runtime management](../../apps/docs/content/docs/concepts/runtime-management.mdx)                                                         |
| Enable, disable, add and remove plugins   | [Plugin manager](../../apps/docs/content/docs/plugin-management.mdx)                                                                       |
| Activate a trusted package catalog        | [Package manager](../../apps/docs/content/docs/package-management.mdx)                                                                     |
| Authentication contract                   | [Client authentication](../../apps/docs/content/docs/reference/authentication.mdx)                                                         |
| Server operations and the request context | [The server half](../../apps/docs/content/docs/concepts/server.mdx), [Server reference](../../apps/docs/content/docs/reference/server.mdx) |
| Test a plugin folder or its server half   | [Testing](../../apps/docs/content/docs/reference/testing.mdx)                                                                              |
| Standalone example                        | [To-do walkthrough](../../apps/docs/content/docs/concepts/tutorial.mdx); runnable JavaScript files in `examples/`                          |

Plugins are trusted application code. Core is not a sandbox, package installer or remote
marketplace. Services own state and resources; the host owns routing, persistence providers and
its authentication. Server operations declare who may call them (`access`); the app's
`requestContext` provider verifies the caller, and Core never decides roles itself.

## Source responsibilities: the server half

- `src/server/index.ts`: the `@bitakit/core/server` entry; `define.ts` gives the root helpers
  their server types.
- `src/server/create-server.ts`: the lazy `Server` handle and the process-wide live-kernel
  registry (`instance`, `stamp`); `kernel.ts`: one call (lookup, access, validation,
  interceptors, execute, output, errors); `compile.ts`: the frozen operation table built at boot;
  `access.ts`: identity normalization and access rules; `validate.ts`: schema checks.
- `src/server/fetch-handler.ts`: the built-in JSON transport; `contributions.ts`: `contributionsOf`.
- `src/remote.ts`: the client's `remote`, `ServerActionMap`/`ServerServiceMap` and the reserved
  name segments; `src/operation-error.ts`: the request-error model; `src/request-context.ts`: the
  `requestContext` contract and `ctx` types; `src/runtime-mode.ts` and `src/settings/server.ts`:
  the runtime's server mode and per-request settings.
- `testing/index.mjs`: `mountPlugin`, `mountServer`, `identity`, `assertAuthContract`.

## Metadata and provenance

`src/metadata.ts` owns the pure public-field projection shared by build tools and runtime.
`projectPluginMetadataSources` accepts ordered `{ value, location }` sources so tools can name
actual diagnostic sources without changing the field validators. Included folder provenance
bindings preserve existing plugin metadata before package fallbacks.
`src/inspection/plugin-origin.ts` binds host evidence to definitions and projects membership
and groups; `src/inspection/inventory.ts` supplies serializable static/live inspection.
See the [identity and metadata reference](../../apps/docs/content/docs/reference/plugin-metadata.mdx).

## License

[MIT](https://github.com/mvavesal/bitakit/blob/main/LICENSE). Third-party dependencies retain
their own licenses.

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
