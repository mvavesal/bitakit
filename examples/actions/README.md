# Actions: a playground

Six examples of `defineAction`, one tab each. Every button, field and checkbox in them is a
plain component inside `<Action>`: the Action gives it its label, state and value and runs when
it is used. Each tab links to its part of the documentation, and **Show source code** opens a
drawer with the Action's source; **Full sample** there adds the UI around it.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

**1 · Live action** makes Actions while the app runs. It starts with "Action 1" in the app
bar; **Add action** adds more, and the tabs under the buttons pick the one to change. Tick where
it shows (the app bar, the sidebar or both), type a title and tooltip, pick an icon, and tick
Enabled, Visible, Ask first or Takes a second: every place follows as you type. Alt+1, Alt+2…
run them from anywhere.

| File                    | What it is                                                                  |
| ----------------------- | --------------------------------------------------------------------------- |
| `live-action.ts`        | The Action: `liveAction(config)` returns a `defineAction` with plain values |
| `ui/providers/live.tsx` | Adds one Action per configuration to the app, replaces it after an edit     |
| `services/live.ts`      | The configurations, with `add`, `remove` and `set`                          |
| `actions/live/*.ts`     | Add action, Remove, and the one editor Action every control runs            |

Actions usually come from files. These are made at runtime: the provider asks the host runtime
to add a small plugin with the Action (`runtime.plugins.add`), and to swap it after a change.
Each placement passes its name as the input, and `visible` keeps the ticked ones. These are
sample places: an Action shows in any slot that takes Actions once you list it in `slots`.

| Tab                      | Shows                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| 1 · Live action          | Fields as functions of state, places through `slots` and `input`    |
| 2 · Messages             | `success` after a run, `failure` after a throw                      |
| 3 · Input                | A zod `input` schema: the button waits for a valid name             |
| 4 · While it runs        | Pending state and `concurrency`: `exclusive`, `per-input`, `latest` |
| 5 · Confirm and dialog   | `confirm` asks first, `dialog` opens a component                    |
| 6 · Shortcut, link, menu | `shortcut` (Mod+Shift+H), `href`, and `groups` listed by ActionMenu |

**Try something risky** fails on purpose: its message comes from `failure`, and the error also
appears in the browser console, so the Next.js dev indicator counts it as an issue.

## How the controls bind

| Control                       | Binding                                     | Example           |
| ----------------------------- | ------------------------------------------- | ----------------- |
| A button                      | `<Action id><Button /></Action>`            | every tab         |
| A button with an input        | `<Action id input={row}>`                   | 4 · While it runs |
| A custom control              | `useAction(id)` and `execute(value)`        | 1 · Live action   |
| A placement (`slots`)         | `shell.toolbar`, `shell.navigation`         | 1 · Live action   |
| A field that runs as you type | `<Action id input={query}>{(control) => …}` | 4 · While it runs |

`Tabs` is shadcn's. The source drawer reads the plugin's files as text through
`import.meta.glob` (the `?raw` rule is in `next.config.ts`) and highlights them with
[shiki](https://shiki.style).
