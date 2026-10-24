# Activity

Shows what happened to notes, without changing the notes plugin.

## Public contracts

- `activity.feed` (`services/feed.ts`) keeps the last five entries from `notes.changed`.
- `ui/slots/notes.footer.tsx` renders the feed below the notes list.
- `ui/slots/shell.header.end.tsx` shows the note count from `notes.list` in the header.

## Constraints and checks

Uses only the notes contracts above; delete this folder and notes keeps working. On `/notes`,
add a note: "Recent activity" lists it and the header count rises.
