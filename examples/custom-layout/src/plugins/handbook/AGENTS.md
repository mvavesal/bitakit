# Handbook

The handbook's chapters: a list page and one page per chapter.

## Public contracts

- `chapters.ts`: the chapters (`slug`, `title`, `summary`, `body`); pages import it directly.
- Pages: `/handbook` (the list) and `/handbook/<slug>` (`ui/pages/[slug].tsx`).
- Actions: `handbook.open` (navigation).

## Checks

`/handbook` lists three chapters; a chapter link opens `/handbook/<slug>` with its text.
