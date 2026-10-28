# Audit

Records what happens to the customers plugin, through interceptors only.

## Public contracts

- `services/log.ts` (`audit.log`): `state` (`entries`, newest first, at most 50),
  `record(kind, text)`, `clear()`.
- `interceptors/actions.ts`: every `customers.*` Action (`scope: 'global'`); `after` records
  completed runs, `onError` failed ones.
- `interceptors/calls.ts`: every method call on `customers.list`.
- Actions: `audit.open` (navigation), `audit.clear` (enabled while the log has entries).

## Checks

After adding a customer, `/audit` (reached through the navigation, so the in-memory state stays)
lists `customers.list.add("…")` and `customers.add ran with "…"`.
