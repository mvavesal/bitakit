# @bitakit/tanstack

Optional React TanStack Router/Start host adapter. Install this **instead of** the Next
adapter. Core owns runtime, actions and services, `@bitakit/discovery` owns discovery; UI owns shared
React composition and standard visuals. The adapter connects native routing and nuqs without
another runtime, router, registry or query-state store.

## Integration

Add `bitakit()` from `@bitakit/tanstack/config` before the official `tanstackStart()` Vite
plugin. It runs discovery before the config resolves and keeps regenerating while files
change; the generated `src/bitakit.gen.tsx` is a real file, so no alias is needed.

```ts
// vite.config.ts
import { bitakit } from '@bitakit/tanstack/config';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';

export default { plugins: [bitakit(), tanstackStart()] };
```

Mount `BitaKitProvider` from `./bitakit.gen` inside the TanStack root route, around
`<Outlet />`. Keep `HeadContent`, `Scripts` and native routes in the app, import
`src/bitakit.gen.css` once for the styles of installed packages, and render plugin pages
through a catch-all route with `<PluginPage />`. The generator supplies these native files; it
never copies plugin implementations.

`BitaKitProvider` wraps this package's `BitaKitRuntimeProvider` with the discovered configuration,
the standard UI provider and the nuqs TanStack Router adapter. `additionalPlugins` replaces
matching discovered plugins in place and appends new ones; explicit `plugins` retains
replacement semantics. Use `queryState={false}` only with an existing outer nuqs adapter.
`BitaKitRuntimeProvider` from the package root needs an explicit `config` when used directly.

`BitaKitLink` bridges dynamic action `href` links to TanStack `Link`. It does not claim
compile-time typed route parameters; app-owned typed links should import the native TanStack
`Link`. Navigation reads router state directly; there is no mirrored pathname or query store.
Vite setup runs before React and cannot be activated by a runtime plugin; installing the
package alone does not configure Vite.

`bitakit.config.ts` (optional, `defineBitaKit`) holds discovery overrides; `npx bitakit migrate`
rewrites a 0.1 project, and the deprecated `foundation()` and `defineFoundation` aliases remain
until the packages are migrated.

## Scope and verification

**Experimental:** nuqs documentation still excludes TanStack Start from its supported
coverage. Verified locally with nuqs 2.10.1, TanStack Router 1.170.40 and Start 1.168.59:
packed generated Shell/Quick Search app installs outside the repository, typechecks,
and builds client/SSR output. Browser checks covered settings rendering, query edits,
reload and route-back restoration without reported page errors. This does not establish
all nuqs parsers/options, server loaders, authentication, localization or deployment targets.
No provider libraries were patched or replaced. See https://nuqs.dev/docs/adapters.

The full Shell preset currently triggers Vite's large-chunk advisory. Bundle optimization
is separate from host-adapter correctness; this preset is not a minimal bundle-size claim.

## Source responsibilities

- `src/providers`: router-scoped composition and query adapter.
- `src/routing`: native Link and navigation bindings.
- `src/config.mjs`: the Vite plugin around `@bitakit/discovery` and its development lifecycle.
- `src/cli.mjs`: deprecated shared Node discovery entry; use `bitakit generate`.
- `src/generated.ts`: deprecated fallback; the configuration lives in `src/bitakit.gen.tsx`.

The build entry and client entry stay separate. This package has no dependency on Next.
