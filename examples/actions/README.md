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

**1 · Live action** shows everything an Action can do on one Action. Pick where it shows (the
app bar or the sidebar), type a title and tooltip, pick an icon, and tick Enabled, Visible,
Ask first or Takes a second: every place follows as you type. Alt+1 runs it from anywhere.

It is three short files:

| File               | What it is                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| `services/live.ts` | The state: place, title, tooltip, icon and the switches, and `set()`        |
| `actions/live.ts`  | The Action: every field reads that state; placed in the app bar and sidebar |
| `actions/edit.ts`  | One editor Action: each control runs it with its change, `{ title }`        |

Each placement passes its name as the input, and `visible` keeps the chosen one. These are
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
