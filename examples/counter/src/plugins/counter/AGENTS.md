# Counter

A number on `/counter` with two buttons. The whole feature lives in this folder.

## Public contracts

- `counter.value` (`services/value.ts`) owns `{ count }` with `increment()` and `reset()`.
- `counter.increment` is disabled at 10; `counter.reset` is disabled at 0.

## Constraints and checks

The count lives in memory and resets on reload. From the app root run `npm run typecheck` and
`npx bitakit doctor`; on `/counter`, press Increment until it stops at 10, then Reset.
