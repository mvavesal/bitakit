# Audit

Records what happens to the customers plugin, through interceptors only.

## Public contracts

- `services/log.ts` (`audit.log`): `state` (`entries`, newest first, at most 50),
  `record(kind, text)`, `clear()`.
- `interceptors/actions.ts`: every `customers.*` Action (`scope: 'global'`); `after` records
  completed runs, `onError` failed ones.
- `interceptors/calls.ts`: every method call on `customers.list`.
- `ui/slots/aside.tsx`: the live log as a table in the app's `aside` slot (`src/slots/aside.ts`),
  which `src/layouts/app.tsx` draws as a column on the right of every page.
- Actions: `audit.clear` (enabled while the log has entries).

## Checks

After adding a customer on `/customers`, the log on the right shows
`customers.list.add("…")` and `customers.add ran with "…"` without leaving the page.
