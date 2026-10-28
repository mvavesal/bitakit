# Tasks

A task list in memory, with every text in `locales/en.json` and `locales/de.json`.

## Public contracts

- `services/list.ts` (`tasks.list`): `state` (`tasks`), `add(title)`, `toggle(id)`,
  `clearDone()`. Task titles are user text and are never translated.
- Actions: `tasks.open` (navigation), `tasks.add` (input: a title), `tasks.complete` and
  `tasks.reopen` (input: an id; one of them is visible per task), `tasks.clear` (enabled while
  a task is done).
- `settings.ts`: `tasks.showAdded` (boolean, default `true`).
- Catalog keys (both languages): `tasks.<action>.title`, `tasks.add.success` (`{title}`),
  `tasks.clear.success`, `tasks.settings.title`, `tasks.settings.showAdded.label` and
  `.description`, `tasks.page.*` for the page.

## Checks

In English, adding "Buy milk" shows `Added "Buy milk"` and "1 task left". With the language set
to Deutsch, `/tasks` shows "Noch keine Aufgaben. Füge oben die erste hinzu." and adding shows
`„Milch kaufen“ hinzugefügt`.
