# @bitakit/next

Optional Next.js adapter for Foundation. Core owns discovery, actions, services, configuration, and runtime behavior. This package connects those mechanisms to Next.js; it does not implement another scanner.

## Responsibilities

- `/config`: `withFoundation` runs Core discovery before Next starts and watches source changes during development.
- `foundation-generate`: runs the same generator before standalone builds and type checks.
- `/actions`: connects the root ActionProvider to Next Router and Link.

```ts
// next.config.ts
import { withFoundation } from '@bitakit/next/config';
export default withFoundation({});
```

```tsx
// src/app/layout.tsx
import type { ReactNode } from 'react';
import { FoundationProvider } from '@bitakit/next';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FoundationProvider>{children}</FoundationProvider>
      </body>
    </html>
  );
}
```

`FoundationProvider` is a client component, so the native root layout renders it directly.
The provider supplies standard UI, default English labels, native Next navigation and the
single root ActionProvider. Pass `labels` for translated copy and `ui` only to customize the
standard mapping. Pass props that hold components or functions, such as a custom `ui`, from
a client component.
An existing outer ActionProvider is reused, including its navigation options.
Load the application's existing central theme and package styles as usual.

No `foundation.config.ts`, empty contribution folders or generated imports are required.
`withFoundation` connects generated imports through both Next bundlers. It also writes
`foundation-env.d.ts` so TypeScript sees generated Action and public-service types;
ignore this generated file and `.foundation/` in Git. Custom paths, disabled packages
and discovery overrides can still be specified in `foundation.config.ts`.

Installed direct dependencies may opt into automatic composition through their public
package metadata (see Core's README). Factories create plugin definitions per provider;
Core continues to construct and dispose services. Installing an arbitrary npm dependency
does not activate it. App Preferences automatically contributes discovery and a browser-local default preferences instance.
Shell, Better Auth and server persistence remain explicitly configured capabilities.
Server authentication, routes, secrets and database setup are never inferred from UI installation.

For configured package plugins, use `additionalPlugins`: these replace discovered plugins with matching IDs and append new IDs.
The lower-level `plugins` prop retains its existing replacement semantics, including `[]`.
Pass an explicit `config` for isolated environments without the Next build adapter.

The app is a root module under src. An optional src/plugin.config.ts supplies its ID and dependencies. Each immediate directory under `src/plugins` is discovered as a local plugin, using its folder name as the default ID. Its `plugin.config.ts` is optional and only needed for overrides. The app does not need a wrapper plugin directory.

Use native `src/app/**/page.tsx` and `layout.tsx` for app-owned routes. Do not replace them with root `pages.*.tsx` Foundation contributions. Independent plugin pages use Discovery and the host catch-all; Next.js reserves src/pages for its Pages Router. Actions, services, configs, interceptors, and views follow the shared [Core discovery convention](../core/docs/file-contributions.md). Dot and folder forms are equivalent; legacy suffixes remain supported.

Generated files live under .foundation and contain static imports and typed maps. Client contribution code is not executed during discovery. Opt-in discovery adapters are trusted Node build code. Disabled packages contribute neither runtime entries nor public-service types. Explicit service requirements are checked at runtime.

Both example apps consume this adapter. Run `npm test --workspace @bitakit/next` for discovery integration tests. A different router would have its own thin adapter and reuse Core.

## Source responsibilities

- `providers/`: Next routing/query composition around the shared UI provider.
- `query.ts`: public Next App Router nuqs boundary.
- `routing/`: Shared native Action navigation bindings.
- `config.mjs`, `generate.mjs`: Next build hooks, generated-module aliases and TypeScript connection.
- `generated.ts`: Empty explicit-environment fallback; replaced by the build adapter.
- `index.ts`, `actions.tsx`: Public provider entry points.

## Shared composition and query state

The root provider delegates visual defaults and ordered `additionalPlugins` merging to
`StandardFoundationProvider` in UI's optional components entry. It owns the Next App
Router NuqsAdapter, so hosts must remove redundant wrappers. For an intentional outer
adapter, pass `queryState={false}`. Legacy hosts using standalone Action/UI providers can
import `QueryProvider` from `@bitakit/next/query` at their existing root boundary.
The Web example uses this entry; Content Demo uses the root provider's default boundary.

`src/query.ts` owns the framework-specific query binding. `src/generate.mjs` re-exports
Core's Node-only `generateFoundationHost`; no discovery implementation is duplicated.
The existing generator uses Webpack pending resolution of its Turbopack alias issue.
