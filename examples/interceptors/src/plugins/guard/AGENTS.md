# Guard

Read-only mode for the customers plugin, as a gate from outside.

## Public contracts

- `settings.ts`: `guard.readOnly` (boolean, default `false`, saved in the browser).
- `interceptors/read-only.ts`: `customers.add`, `customers.archive` and `customers.remove`
  (`scope: 'global'`); while `guard.readOnly` is on, `before` shows a warning through Shell's
  `notifications` service and returns `false`.
- `services/blocked.ts` (`guard.blocked`): `state` (`count`, `last`), `record(id)`.
- `ui/slots/shell.header.end.tsx`: a badge while read-only mode is on.

## Checks

Turn on Settings → Guard → **Read-only mode**, press **Archive** on `/customers`: the customer
stays active, "Read-only mode is on" appears and the header shows "Read-only · 1 blocked".
