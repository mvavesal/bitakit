# Todo: state, Actions and the app frame

One plugin in the Shell frame: a service with a list, five Actions (input, per-row, confirm,
success message, navigation) and a Quick Search entry without extra code.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Choose **Todos** in the sidebar and add two todos (Enter submits).
2. Press **Done** on one: its label turns into **Undo**. The subtitle counts what is left.
3. Press **Clear completed**, confirm, and watch the message.
4. Press **Mod+K** and type "Todos": the navigation Action is a search destination.

## What to look at

| File                                      | Role                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `src/plugins/todos/services/list.ts`      | The list and its operations (in memory)                                   |
| `src/plugins/todos/actions/add.ts`        | An Action with input, disabled while it is empty                          |
| `src/plugins/todos/actions/toggle.ts`     | One Action for every row: input is the todo ID, the title follows the row |
| `src/plugins/todos/actions/clear-done.ts` | Confirmation and a success message                                        |
| `src/plugins/todos/actions/open.ts`       | A navigation entry in `shell.navigation`                                  |
| `src/plugins/todos/ui/pages/index.tsx`    | The page; every control is bound to an Action                             |

Guide: [Run an operation from a control](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/guides/run-an-operation.mdx).
