<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:bitakit-agent-rules -->

# BitaKit

This app is organized in BitaKit plugins. Discovery generates `src/bitakit.gen.*` at build
time; there is no registry, provider or import list to edit. One concept, one way:

- One feature = one folder in `src/plugins/<name>/`. The folder name is the plugin ID.
- Start examples with one page, then add a service and an Action in separate steps.
  Add a folder only when needed; keep optional properties and lifecycle details for later lessons.
  - `services/<file>.ts`: `defineService(({ store, events }) => ({ ... }))`. Reached everywhere as
    `services.<name>.<file>`. State uses `store()`; resources use `onStart`/awaited `onStop`. Await runtime `stop()` before replacement.
  - `actions/<file>.ts`: `defineAction({ title, execute })`, ID `<name>.<file>`. Presentation fields may
    be functions: `enabled: ({ services, input }) => ...`. `href` makes a link, `dialog` opens a dialog,
    `slots: ['shell.navigation']` places it in Shell navigation; `slots: ['shell.toolbar']` places a standard button/link in the header. No widget file is needed for either. Groups only organize queries.
  - `events.ts`: `defineEvents({ changed: event<Payload>() })`, emitted and observed as `<name>.changed`.
  - `settings.ts`: `defineSettings({ pageSize: setting({ default: 20 }) })`, read as `settings.<name>.pageSize.get()`
    in services and actions and `useSetting('<name>.pageSize')` in React. Settings get a generated page under
    `/settings`; `ui/settings/page.tsx` replaces it. Additional pages use `ui.settings.pages`; the same catalog projects their routes, navigation Actions and keyed page bodies. Slot extensions use `app-preferences.page.after` with `when({ payload })`; page `boundary` encloses content and extensions. Persistence is the `settings.storage` contract (browser by default).
  - `slots/<file>.ts`: `defineSlot({ accepts: 'actions' | 'component' | 'data', policy: 'list' | 'single' | 'keyed' })` (data requires schema). Owned contracts; data requires schema. In setup, attach with `scope.slots.attach({ slot, component | data | actionId }, { availability: 'wait' })`; cleanup is automatic.
  - `ui/pages/<path>.tsx`: a page component; the file path is the URL. `ui/slots/<slot>.tsx`: a component
    attached when both owners are ready; `PluginSlot` isolates widget render errors automatically. Everything under `ui/` is React; nothing else may import React.
- In React: `useServiceState('<name>.<file>', (state) => ...)` for reactive data from a ready owner,
  `<Action id="<name>.<file>" input={...}><Button /></Action>` to bind any control, `useEvent('<name>.changed', fn)`.
- Create files with the CLI: `npx bitakit add plugin <name>`,
  `npx bitakit add action|service|page|interceptor|config|slot-definition <name>/<file>`, `npx bitakit add events|settings|settings-page <name>`.
- App layouts live in `src/layouts/<name>.tsx`; a page opts in with `export const layout = '<name>'` (`'blank'` for none).
- Inspect declarations with `npx bitakit info --json` (static only); verify with `npx bitakit doctor` and `npm run typecheck`.
- App-owned routes stay native framework routes in `src/app`.
- Use the standard components from `@bitakit/ui/components` and the app theme; do not restyle them locally.
- Visual packages declare exported CSS in `bitakit.styles` and intentional theme mappings in `bitakit.theme`, and export `./package.json`. Do not import package CSS from JavaScript, including lazy modules; Discovery owns the root CSS graph and layer order.
- For Shell Actions use shell.navigation or shell.toolbar. For custom header content use ui/slots/shell.header.end.tsx. Settings pages stay automatic; extend page regions instead of registering them again.
- The generated provider is component-only; advanced createBitaKitConfig imports use bitakit.gen.config.
- Never edit generated files: `src/bitakit.gen.*`.

<!-- END:bitakit-agent-rules -->
