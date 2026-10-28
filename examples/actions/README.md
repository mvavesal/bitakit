# Actions: a playground

Six examples of `defineAction`, one tab each. Every button, field and checkbox in them is a
plain component inside `<Action>`: the Action gives it its label, state and value and runs when
it is used. Each tab has a **Code** button that opens its files, highlighted, in a drawer.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

**1 · Live action.** Press **Add action**: "Action 1" appears in the app bar and in the card.
Under **Places**, tick Sidebar or Sidebar footer, untick App bar; then type a title and a
tooltip, pick an icon, untick **Enabled**. Every place follows as you type. Add up to four and
pick the one to edit under **Edit**.

The live Actions are four declared Actions (`actions/live/first.ts` to `fourth.ts`, built by
`actions/-live.ts`). Each field is a function of its entry in `services/live.ts`, so the
editor never touches an Action: its controls are Actions of three lines that change one field.
Each place passes its name as input, and `visible` shows the Action where its entry lists it.

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

| Control                   | Binding                                    | Example                  |
| ------------------------- | ------------------------------------------ | ------------------------ |
| A button                  | `<Action id><Button /></Action>`           | every tab                |
| A button with an input    | `<Action id input={row}>`                  | 4 · While it runs        |
| A checkbox (`checked`)    | `<Action id kind="toggle"><Checkbox />`    | 1 · Live action, Enabled |
| A radio group (`value`)   | `<Action id kind="choice"><RadioGroup>`    | 1 · Live action, Icon    |
| A checkbox list (`value`) | `<Action id kind="choice"><CheckboxGroup>` | 1 · Live action, Places  |
| A text field (`value`)    | `<Action id kind="choice"><TextField>`     | 1 · Live action, Title   |
| A placement (`slots`)     | `shell.toolbar`, `shell.navigation`        | 1 · Live action          |
| A component slot          | `ui/slots/*.tsx` with `<Action input>`     | 1 · Live action          |

`CheckboxGroup` and `TextField` (`src/components/ui`) are small standard controls with
`value` and `onValueChange`, the two props a `choice` binding passes. `Tabs` is shadcn's. The
Code drawer reads the plugin's files as text through `import.meta.glob` (the `?raw` rule is in
`next.config.ts`) and highlights them with [shiki](https://shiki.style).
