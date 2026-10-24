# Notes

Owns the notes feature on `/notes`. Three other plugins extend it; none edits this folder.

## Public contracts

- `notes.list` (`services/list.ts`) owns `notes` (`id`, `title`) with `add(title)` and
  `remove(id)`; `add` puts new notes first while `notes.newestFirst` is on.
- `notes.changed` (`events.ts`) carries `{ kind: 'added' | 'removed', title }`, emitted
  after each change.
- Slots: `notes.toolbar` (Actions, above the list) and `notes.footer` (components, below it),
  both rendered by `ui/pages/index.tsx`.
- Actions: `notes.add` (title string), `notes.remove` (note ID), `notes.open` (navigation).
- Setting `notes.newestFirst` at `/settings/notes`.
- `setup.ts` adds the Quick Search source `notes` when Quick Search is installed.

## Constraints and checks

Notes live in memory and reset on reload. Change a contract only with a reason, and update
the extending plugins' guides when one changes. From the app root run `npm run typecheck`
and `npx bitakit doctor`; on `/notes`, add and delete a note and search it with Mod+K.
