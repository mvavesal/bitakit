<p align="center">
  <img src="https://raw.githubusercontent.com/mvavesal/bitakit/main/docs/assets/readme/bitakit-banner.png" alt="BitaKit — Your app. Your building blocks. An AI-friendly composition layer for modern applications." width="1024">
</p>

# BitaKit Core

Framework-independent plugins, services, Actions, events, settings and lifecycle management.
Core works in Node.js and the browser without React or a router. React bindings, discovery,
visual plugins and provider integrations are separate packages.

## Install

```sh
npm install @bitakit/core
```

For a new application, `npx @bitakit/create-app my-app` connects the packages for you
(Node.js 24 or newer). The handbook describes the 0.2 API in this checkout; use matching
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

## Developer handbook

The handbook is maintained once in the documentation website's source. The links below
resolve within a repository checkout and follow the branch viewed on GitHub. Run
`npm run dev:docs` from the repository root to read the rendered handbook at
`http://localhost:3002/docs`. A public documentation address is not configured yet.

| Topic                                   | Guide                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Services and cleanup                    | [Service reference](../../apps/docs/content/docs/reference/services.mdx)                                                                   |
| Actions and React bindings              | [Action reference](../../apps/docs/content/docs/reference/actions.mdx)                                                                     |
| Events and interception                 | [Events](../../apps/docs/content/docs/concepts/events.mdx), [Interceptors](../../apps/docs/content/docs/concepts/interceptors.mdx)         |
| Files and developer configuration       | [Discovery](../../apps/docs/content/docs/concepts/discovery.mdx), [Configuration](../../apps/docs/content/docs/concepts/configuration.mdx) |
| Extension points and preferences        | [Slots](../../apps/docs/content/docs/reference/slots.mdx), [Settings](../../apps/docs/content/docs/reference/settings.mdx)                 |
| Runtime updates and diagnostics         | [Runtime management](../../apps/docs/content/docs/concepts/runtime-management.mdx)                                                         |
| Enable, disable, add and remove plugins | [Plugin manager](../../apps/docs/content/docs/plugin-management.mdx)                                                                       |
| Activate a trusted package catalog      | [Package manager](../../apps/docs/content/docs/package-management.mdx)                                                                     |
| Authentication contract                 | [Client authentication](../../apps/docs/content/docs/reference/authentication.mdx)                                                         |
| Test a plugin folder                    | [Testing](../../apps/docs/content/docs/reference/testing.mdx)                                                                              |
| Standalone example                      | [To-do walkthrough](../../apps/docs/content/docs/concepts/tutorial.mdx); runnable JavaScript files in `examples/`                          |

Plugins are trusted application code. Core is not a sandbox, package installer or remote
marketplace. Services own state and resources; the host owns routing, persistence providers
and server authorization.

## Metadata and provenance

`src/metadata.ts` owns the pure public-field projection shared by build tools and runtime.
`src/inspection/plugin-origin.ts` binds host evidence to definitions and projects membership
and groups; `src/inspection/inventory.ts` supplies serializable static/live inspection.
See the [identity and metadata reference](../../apps/docs/content/docs/reference/plugin-metadata.mdx).

## License

[MIT](https://github.com/mvavesal/bitakit/blob/main/LICENSE). Third-party dependencies retain
their own licenses.
