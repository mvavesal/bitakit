# Todos

A todo list on `/todos`, linked from the Shell navigation.

## Public contracts

- `todos.list` (`services/list.ts`) owns `todos` (`id`, `title`, `done`) with `add(title)`,
  `toggle(id)`, `remove(id)` and `clearDone()`.
- `todos.add` takes a title string and is disabled while it is empty.
- `todos.toggle` and `todos.remove` take a todo ID and run per row (`concurrency: per-input`).
- `todos.clear-done` confirms, then shows "Completed todos deleted".
- `todos.open` links to `/todos` in `shell.navigation`; Quick Search lists it.

## Constraints and checks

The list lives in memory and resets on reload. No events or slots yet. From the app root run
`npm run typecheck` and `npx bitakit doctor`; on `/todos`, add two todos, mark one done and
clear completed.
