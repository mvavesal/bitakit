# Guard

Rules over the notes plugin, kept outside it.

## Public contracts

- `interceptors/no-duplicates.ts` skips a `notes.add` run whose title already exists
  (case-insensitive). It uses `scope: 'global'` to reach another plugin's Action.
- `interceptors/trace.ts` logs every `notes.list` call to the console.

## Constraints and checks

Client rules only, not authorization. On `/notes`, add the same title twice: only one note
appears and the console shows `[guard] notes.list add`.
