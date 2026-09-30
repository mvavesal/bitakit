# @bitakit/tanstack

Optional React TanStack Router/Start host adapter. Install this **instead of** the Next
adapter. Core owns runtime, Actions, services and discovery; UI owns shared React
composition and standard visuals. The adapter connects native routing and nuqs without
another runtime, router, registry or query-state store.

## Integration

Add `foundation()` from `@bitakit/tanstack/config` before the official
`tanstackStart()` Vite plugin. Mount `FoundationProvider` from the package root inside
the TanStack root route, around `<Outlet />`. Keep HeadContent, Scripts and native
routes in the app. Import shared Foundation styles and the selected plugin styles.
The generator supplies these native files; it never copies plugin implementations.

`FoundationProvider` uses the standard UI provider, generated config and the nuqs
TanStack Router adapter. `additionalPlugins` replaces matching discovered plugins in
place and appends new ones. Explicit `plugins` retains replacement semantics. Use
`queryState={false}` only with an existing outer nuqs adapter. Required services and
plugin lifecycle still use the ordinary Foundation runtime.

`FoundationLink` bridges dynamic Foundation `href` links to TanStack Link. It does not
claim compile-time typed route parameters; app-owned typed links should import the
native TanStack Link. Navigation reads router state directly. There is no mirrored
pathname/query store. Framework Vite setup runs before React and cannot be activated by
a runtime plugin; installing the integration package alone does not configure Vite.

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

- `src/providers`: router-scoped Foundation composition and query adapter.
- `src/routing`: native Link and navigation bindings.
- `src/config.mjs`: Vite alias and development lifecycle around Core discovery.
- `src/cli.mjs`: shared Node discovery entry for standalone typechecking.
- `src/generated.ts`: explicit-config fallback replaced by the build alias.

The build entry and client entry stay separate. This package has no dependency on Next.
