# @bitakit/next — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/next`). To
> change the package itself, follow the repository's own AGENTS.md instead.

The Next.js adapter: it runs discovery from `next.config.ts` and connects the BitaKit provider
to Next.js routing and query state. Apps from create-app are already wired; do not rewire them.

## The wiring an app has

- `next.config.ts`: `export default withBitaKit({ ... })` from `@bitakit/next/config`; it
  regenerates `src/bitakit.gen.*` while files change. Never edit the generated files.
- `src/app/layout.tsx`: `<BitaKitProvider>{children}</BitaKitProvider>` from `@/bitakit.gen`,
  once, at the root. `src/app/globals.css` imports `bitakit.gen.css` once.
- `src/app/(app)/[...path]/page.tsx`: renders plugin pages with
  `<PluginPage fallback={<NotFoundPage />} />`.
- `src/app/(app)/error.tsx` and `src/app/not-found.tsx` render Shell's replaceable
  `screen.error` and `screen.not-found` (Next.js passes `retry` to `error.tsx`).

## Routes

- Plugin pages (`src/plugins/<id>/ui/pages/...`) render in the browser after the runtime starts.
- Pages that need server rendering, `metadata`, redirects or API handlers stay native routes
  in `src/app` (`src/app/api/<name>/route.ts`). An app route at the same path wins over a plugin
  page; `npx bitakit doctor` reports it.
- URL query state uses nuqs through this adapter; do not mirror it into a store.

## Rules

- This Next.js version may differ from what you know: read the guides in
  `node_modules/next/dist/docs/` before writing route or config code.
- Run `npm run typecheck` (it runs `bitakit generate`, `next typegen` and `tsc`).
