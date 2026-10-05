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
- Start small: a plugin is complete with one or two files (a page, or a service and an action).
  Add a folder only when the feature needs it; never scaffold every kind.
  - `services/<file>.ts`: `defineService(({ store, events }) => ({ ... }))`. Reached everywhere as
    `services.<name>.<file>`. Put state in `store()`; actions and pages follow it automatically.
  - `actions/<file>.ts`: `defineAction({ title, execute })`, ID `<name>.<file>`. Presentation fields may
    be functions: `enabled: ({ services, input }) => ...`. `href` makes a link, `dialog` opens a dialog,
    `slots: ['shell.navigation']` places it in Shell; groups only organize queries.
  - `events.ts`: `defineEvents({ changed: event<Payload>() })`, emitted and observed as `<name>.changed`.
  - `settings.ts`: `defineSettings({ pageSize: setting({ default: 20 }) })`, read as `settings.<name>.pageSize.get()`
    in services and actions and `useSetting('<name>.pageSize')` in React. Settings get a generated page under
    `/settings`; `ui/settings/page.tsx` replaces it. Persistence is the `settings.storage` contract (browser by default).
  - `ui/pages/<path>.tsx`: a page component; the file path is the URL. `ui/slots/<slot>.tsx`: a component
    placed in a layout slot. Everything under `ui/` is React; nothing else may import React.
- In React: `useServiceState('<name>.<file>', (state) => ...)` for reactive data,
  `<Action id="<name>.<file>" input={...}><Button /></Action>` to bind any control, `useEvent('<name>.changed', fn)`.
- Create files with the CLI: `npx bitakit add plugin <name>`,
  `npx bitakit add action|service|page|interceptor|config <name>/<file>`, `npx bitakit add events|settings <name>`.
- App layouts live in `src/layouts/<name>.tsx`; a page opts in with `export const layout = '<name>'` (`'blank'` for none).
- After changes run `npx bitakit doctor` and `npm run typecheck`.
- App-owned routes stay native framework routes in `src/app`.
- Use the standard components from `@bitakit/ui/components` and the app theme; do not restyle them locally.
- Never edit generated files: `src/bitakit.gen.*`.

<!-- END:bitakit-agent-rules -->
