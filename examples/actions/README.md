# Actions: every option on one page

A playground for `defineAction`, sixteen numbered examples in five colored groups. The first
card moves one Action around the app while you change it; each card after it shows one option
of an Action: what it does, the file that declares it and a live control bound to it. Open the
file under a card next to the page and change it; the page updates as you save.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

Start with **One Action, every place** (example 1). The live Action is in the card, in the
More menu and in the place you pick, at first the right side of the app bar:

1. Type a new title and tooltip, and pick another icon: every place changes as you type.
2. Pick another **Place**, for example the sidebar footer. A message names it and the icon
   bounces there for three seconds; **Show me where** does the same without moving it.
3. Untick **Enabled**, then **Visible**: it turns grey, then disappears, everywhere.
4. Press **Add an item** twice: two sample Actions appear in the sidebar and in the card.

None of these controls touches the live Action. Each is an Action of a few lines that changes
one field of `services/live.ts`, bound to a plain field, radio group, checkbox or button. The
live Action's `title`, `tooltip`, `enabled` and `visible` are functions of that state, so every
place that shows it updates by itself. Each placement passes its place as the input, and
`visible` shows the Action only where the state says; the card and the More menu pass no input
and always show it. An Action's `icon` is a component, not a function of the state, so
`ui/live-icon.tsx` reads the state, draws the chosen icon and bounces during the spotlight.

Then the other cards:

1. Open **Playground** and press **Say hello**: the message comes from `success`.
2. Type one letter into **Your name**: **Greet** stays disabled until the schema accepts the
   name.
3. Press **Click me** three times. Its title counts along, and **Secret button** appears.
4. Like two fruits quickly: each row shows its own pending state.
5. Type into **Search fruit**: every keystroke starts a search, and only the last one lands.
6. Press Mod+Shift+H anywhere on the page (Cmd on a Mac, Ctrl elsewhere).
7. **Reset the playground** asks first; **Cancel** keeps everything as it is.

**Try something risky** fails on purpose. Its message comes from `failure`, and the error also
appears in the browser console, so the Next.js dev indicator counts it as an issue.

## Where each option lives

All files are in `src/plugins/playground/`.

| Option                     | File                                                | Bound with                          |
| -------------------------- | --------------------------------------------------- | ----------------------------------- |
| Every presentation field   | `actions/live/target.ts`                            | every place at once, no own code    |
| `slots` with an `input`    | `actions/live/target.ts`                            | `shell.toolbar`, `shell.navigation` |
| A component slot           | `ui/slots/*.tsx`, `ui/live-place.tsx`               | `<Action input={place}>`            |
| A text field               | `actions/live/rename.ts`, `actions/live/tooltip.ts` | `control.value`, `control.execute`  |
| Placed in an own slot      | `actions/sample/*.ts`, `slots/samples.ts`           | `useSlot('playground.samples')`     |
| `execute`, `success`       | `actions/hello.ts`                                  | `<Action><Button /></Action>`       |
| `input` (a zod schema)     | `actions/greet.ts`                                  | `<Action input={name}>`             |
| `title` from a service     | `actions/count.ts`                                  | `<Action>`                          |
| `visible`                  | `actions/unlocked.ts`                               | `<Action>`                          |
| A promise and `pending`    | `actions/slow.ts`                                   | `<Action pending="…">`              |
| `confirm`, `variant`       | `actions/reset.ts`                                  | `<Action>`                          |
| `failure`                  | `actions/fail.ts`                                   | `<Action>`                          |
| `dialog`                   | `actions/details.ts`                                | `<Action>`                          |
| `concurrency: 'per-input'` | `actions/like.ts`                                   | `<Action input={row}>` per row      |
| `concurrency: 'latest'`    | `actions/search.ts`                                 | `control.execute(query)`            |
| `checked`                  | `actions/favorite.ts`                               | `<Action kind="toggle">`            |
| `value`                    | `actions/sort.ts`                                   | `<Action kind="choice">`            |
| `shortcut`                 | `actions/shortcut.ts`                               | `<ActionShortcutLabel>`             |
| `href`                     | `actions/docs.ts`, `actions/open.ts`                | `<Action>` around an `<a>`          |
| `groups`                   | `actions/copy.ts`, `actions/print.ts`               | `<ActionMenu group>`                |

The state the Actions read and change is one service, `services/demo.ts`; the page reads it
with `useServiceState('playground.demo', ...)`. The page itself, `ui/pages/index.tsx`, never
writes `disabled`, `onClick` or a loading flag: those come from the Action it binds.

The colored pills come from `ui/groups.tsx`. The theme's own colors are neutral, so the tints
are set there, in one place, to tell the groups apart.
