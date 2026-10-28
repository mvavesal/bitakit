# Audit

Records what happens to the customers plugin, through interceptors only.

## Public contracts

- `services/log.ts` (`audit.log`): `state` (`entries`, newest first, at most 50),
  `record(kind, text)`, `clear()`.
- `interceptors/actions.ts`: every `customers.*` Action (`scope: 'global'`); `after` records
  completed runs, `onError` failed ones.
- `interceptors/calls.ts`: every method call on `customers.list`.
- `ui/slots/shell.content.after.tsx`: the live panel below every page (the newest 8 entries).
- Actions: `audit.clear` (enabled while the log has entries).

## Checks

After adding a customer on `/customers`, the panel below the list shows
`customers.list.add("…")` and `customers.add ran with "…"` without leaving the page.
