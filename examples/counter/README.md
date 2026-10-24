# Counter: the smallest feature

One plugin with a page, a service and two Actions. Start here.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **/counter** and press **Increment** a few times.
2. At 10 the button is disabled: the rule lives in the Action, not in the button.
3. Press **Reset**.

## What to look at

| File                                       | Role                                                   |
| ------------------------------------------ | ------------------------------------------------------ |
| `src/plugins/counter/ui/pages/index.tsx`   | The page at `/counter`; binds both buttons to Actions  |
| `src/plugins/counter/services/value.ts`    | The service `counter.value`: the count and two methods |
| `src/plugins/counter/actions/increment.ts` | The Action `counter.increment`, disabled at 10         |
| `src/plugins/counter/actions/reset.ts`     | The Action `counter.reset`, disabled at 0              |

Everything else is the generated app. The same code is explained step by step in
[Build your first feature](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/concepts/index.mdx).
