# Interceptors: watch and gate a feature you do not own

Three plugins. **customers** owns a customer list and its buttons, and knows nothing about the
other two. **audit** records every customers Action and every call to its service. **guard**
blocks the changing Actions while read-only mode is on. Neither of them edits a file in
`src/plugins/customers`.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Customers**, add "Ada Corp", then try "contoso": that name is taken, and the Action
   fails with the service's message.
2. Archive Northwind Traders.
3. Open **Audit log**: each Action, each service call and the failure, newest first.
4. Settings → Guard → switch on **Read-only mode**.
5. Back on **Customers**, press **Archive** or **Remove**: nothing changes, a message says
   "Read-only mode is on", and the header shows "Read-only · 1 blocked". Turn the mode off and
   the buttons work again.

The customers live in memory, so a reload starts over; the read-only setting stays in this
browser. A failed Action also appears in the browser console, so the Next.js dev indicator
counts it as an issue.

## How it works

| File                                              | Kind                | What it does                                       |
| ------------------------------------------------- | ------------------- | -------------------------------------------------- |
| `src/plugins/audit/interceptors/actions.ts`       | Action interceptor  | `action: 'customers.*'`: `after` and `onError` log |
| `src/plugins/audit/interceptors/calls.ts`         | Service interceptor | `service: 'customers.list'`: logs each method call |
| `src/plugins/guard/interceptors/read-only.ts`     | Action interceptor  | `before` returns `false` while the setting is on   |
| `src/plugins/guard/settings.ts`                   | Setting             | `guard.readOnly`, read with `app.settings`         |
| `src/plugins/guard/ui/slots/shell.header.end.tsx` | Slot                | The header badge                                   |

A plugin's interceptor only sees its own plugin's Actions until it sets `scope: 'global'`;
service interceptors see every service. `before` returning `false` skips the run with the
reason `intercepted` before any confirmation dialog opens. Observers (`after`, `onError`) never
change a result. When the owner of an Action knows a rule itself, `enabled` on the Action is the
better place; an interceptor is for rules that come from somewhere else.
