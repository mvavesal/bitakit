# @bitakit/next

Optional Next.js adapter for BitaKit. Core owns discovery, actions, services, configuration and
runtime behavior. This package connects those mechanisms to Next.js; it does not implement
another scanner.

## Responsibilities

- `/config`: `withBitaKit` runs Core discovery before Next reads its configuration and keeps
  regenerating while files change during development.
- The root entry: `FoundationProvider`, the shared UI provider with Next routing and query state.
- `/actions`: connects a standalone root `ActionProvider` to the Next router and `Link`.

```ts
// next.config.ts
import { withBitaKit } from '@bitakit/next/config';

export default withBitaKit({});
```

```tsx
// src/app/layout.tsx
import type { ReactNode } from 'react';
import { BitaKitProvider } from '@/bitakit.gen';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BitaKitProvider>{children}</BitaKitProvider>
      </body>
    </html>
  );
}
```

Discovery writes `src/bitakit.gen.tsx`, which exports `createBitaKitConfig()` and
`BitaKitProvider`, a thin wrapper around this package's `FoundationProvider` with the
discovered configuration. Because the generated file is a real file, no bundler alias is
needed: Turbopack and Webpack behave the same, and `next dev` and `next build` run without
flags. Add `src/bitakit.gen.*` to `.gitignore`.

`BitaKitProvider` is a client component, so the native root layout renders it directly. It
supplies standard UI, default English labels, native Next navigation and the single root
ActionProvider. Pass `labels` for translated copy, `notify` for toasts, `controls` to map
control props to your component library and `ui` only to customize the standard mapping;
props that hold components or functions must come from a client component. An existing outer
ActionProvider is reused, including its navigation options. Import `src/bitakit.gen.css` once
in your global stylesheet for the styles of installed packages.

Use `FoundationProvider` from the package root directly only with an explicit `config`, for
example in an isolated environment without the build adapter; without `config` it throws.

## Discovery and routes

`bitakit.config.ts` (optional, `defineBitaKit` from `@bitakit/core/discovery`) holds overrides:
plugin directory, disabled packages, config and action overrides. Each immediate directory under
`src/plugins` is a plugin named after its folder; the app itself contributes from the same
folders directly under `src`. Installed packages that declare `bitakit.plugin` in their
`package.json` are composed automatically. Installing an arbitrary npm dependency does not
activate it, and server authentication, routes, secrets and database setup are never inferred
from UI installation.

Use native `src/app/**/page.tsx` and `layout.tsx` for app-owned routes. Plugin pages live in
`ui/pages` of their plugin and are rendered by the generated catch-all route
(`src/app/[...path]/page.tsx` with `<PluginPage />`); explicit app routes take precedence.
Next.js reserves `src/pages` for its Pages Router.

For configured package plugins, use `additionalPlugins` on the provider: entries replace
discovered plugins with matching IDs in place and append new IDs. The lower-level `plugins`
prop retains replacement semantics, including `[]`.

## Query state and composition

The root provider owns the Next App Router nuqs boundary, so hosts must not add a redundant
`NuqsAdapter`. For an intentional outer adapter, pass `queryState={false}`. Standalone hosts
with their own Action/UI providers can import `QueryProvider` from `@bitakit/next/query`.

## Migration from 0.1

`npx bitakit migrate` renames `foundation.config.ts` to `bitakit.config.ts`, rewrites
`.foundation/*` and `@bitakit/next/generated` imports to `./bitakit.gen`, removes `--webpack`
and `foundation-generate` from scripts and deletes the old generated output. `withFoundation`
and `@bitakit/next/generated` were removed in Phase 5; use `withBitaKit` and `./bitakit.gen`.

## Source responsibilities

- `providers/`: Next routing/query composition around the shared UI provider.
- `query.ts`: public Next App Router nuqs boundary.
- `routing/`: shared native Action navigation bindings.
- `config.mjs`: the Next build hook around Core discovery; `cli.mjs`: deprecated generate entry.
- `generated.ts`: deprecated fallback; the configuration now lives in `src/bitakit.gen.tsx`.
- `index.ts`, `actions.tsx`: public provider entry points.

Run `npm test --workspace @bitakit/next` for discovery integration tests. A different router
would have its own thin adapter and reuse Core.
