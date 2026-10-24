<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:bitakit-agent-rules -->

# BitaKit

BitaKit is a composition layer for building apps with AI agents. One feature = one folder in `src/plugins/<name>/`;
the file path is the ID. Discovery generates `src/bitakit.gen.*`; there is no registry to edit.

| Task                                   | Where it goes                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| A page                                 | `ui/pages/<path>.tsx`, served at `/<name>/<path>`                                           |
| A button, link or menu entry           | `actions/<file>.ts`: `defineAction({ title, execute })`, ID `<name>.<file>`                 |
| Shared state or logic                  | `services/<file>.ts`: `defineService(({ store }) => ({ ... }))`, `services.<name>.<file>`   |
| A user setting                         | `settings.ts`: `defineSettings({ size: setting({ default: 20 }) })`, `settings.<name>.size` |
| Tell other features something happened | `events.ts`: `defineEvents({ changed: event<T>() })`, `<name>.changed`                      |
| Let other features add UI here         | `slots/<file>.ts`: `defineSlot(...)`; others fill it from `ui/slots/<slot>.tsx`             |
| Change a feature you do not own        | Listen to its events, fill its slots or read its settings from your own plugin              |

- Start with a page, then a service and an Action; add files only when needed. A small plugin
  may keep one record file per kind (`actions.ts` exporting `{ add, remove }`, same IDs).
- Bind every control that runs an operation to its Action: `<Action id="<name>.<file>" input={...}><Button /></Action>`,
  `ActionButton` or `ActionLink`. Label, disabled, pending and confirmation come from the Action, not from
  hand-written `disabled`/`onClick` state.
- In React: `useServiceState('<name>.<file>', (state) => ...)`, `useSetting('<name>.<key>')`, `useEvent('<name>.changed', fn)`.
  React only under `ui/`. Use `@bitakit/ui/components` and the app theme; do not restyle locally or
  import package CSS from JavaScript (discovery writes `src/bitakit.gen.css`).
- Do not rebuild what BitaKit provides: no own registries, event buses, settings stores or button state.
- App-owned routes stay native framework routes in `src/app`; layouts live in `src/layouts/<family>.tsx` (pages pick one with `export const layout`).
- Each installed `@bitakit/*` package explains itself in `node_modules/@bitakit/<name>/AGENTS.md`; read it before using the package.
- Create files with `npx bitakit add plugin <name>` and `npx bitakit add <kind> <name>/<file>` (`events` and
  `settings` take only `<name>`); list IDs with `npx bitakit info --json` and slots with `npx bitakit slots`; check with `npx bitakit doctor` and `npm run typecheck`.
- For feature work, use the project-local `bitakit-app-development` skill (`$bitakit-app-development` in Codex,
  `/bitakit-app-development` in Claude Code, otherwise read `.agents/skills/bitakit-app-development/SKILL.md`):
  recipes for each task above, slot and layout choice, and checking the result in the browser.
- Advanced, only when needed: interceptors, configs, providers, dialogs, `setup.ts`, `plugin.config.ts`.
- Never edit generated files: `src/bitakit.gen.*`.

<!-- END:bitakit-agent-rules -->
