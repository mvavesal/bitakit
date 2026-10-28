# Actions: every option on one page

A playground for `defineAction`. Each card on the page shows one option of an Action: what it
does, the file that declares it and a live control bound to it. Open the file under a card next
to the page and change it; the page updates as you save.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

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

| Option                     | File                                  | Bound with                     |
| -------------------------- | ------------------------------------- | ------------------------------ |
| `execute`, `success`       | `actions/hello.ts`                    | `<Action><Button /></Action>`  |
| `input` (a zod schema)     | `actions/greet.ts`                    | `<Action input={name}>`        |
| `title` from a service     | `actions/count.ts`                    | `<Action>`                     |
| `visible`                  | `actions/unlocked.ts`                 | `<Action>`                     |
| A promise and `pending`    | `actions/slow.ts`                     | `<Action pending="…">`         |
| `confirm`, `variant`       | `actions/reset.ts`                    | `<Action>`                     |
| `failure`                  | `actions/fail.ts`                     | `<Action>`                     |
| `dialog`                   | `actions/details.ts`                  | `<Action>`                     |
| `concurrency: 'per-input'` | `actions/like.ts`                     | `<Action input={row}>` per row |
| `concurrency: 'latest'`    | `actions/search.ts`                   | `control.execute(query)`       |
| `checked`                  | `actions/favorite.ts`                 | `<Action kind="toggle">`       |
| `value`                    | `actions/sort.ts`                     | `<Action kind="choice">`       |
| `shortcut`                 | `actions/shortcut.ts`                 | `<ActionShortcutLabel>`        |
| `href`                     | `actions/docs.ts`, `actions/open.ts`  | `<Action>` around an `<a>`     |
| `groups`                   | `actions/copy.ts`, `actions/print.ts` | `<ActionMenu group>`           |

The state the Actions read and change is one service, `services/demo.ts`; the page reads it
with `useServiceState('playground.demo', ...)`. The page itself, `ui/pages/index.tsx`, never
writes `disabled`, `onClick` or a loading flag: those come from the Action it binds.
