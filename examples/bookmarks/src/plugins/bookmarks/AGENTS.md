# Bookmarks

Links to come back to, stored in SQLite on the server.

## Public contracts

- `services/list.ts` (`bookmarks.list`) holds the browser's copy: `bookmarks`, `status`
  (`loading`, `ready`, `error`) and `error`. It loads on start and calls `/api/bookmarks`.
- Actions: `bookmarks.open` (navigation), `bookmarks.add` (input: a URL), `bookmarks.remove`
  (input: an id), `bookmarks.reload`.
- Setting: `bookmarks.openInNewTab`.

## Data

The API route `src/app/api/bookmarks/route.ts` validates input and reads and writes
`data/bookmarks.db` through `src/server/database.ts`. Server code stays there; this folder has
no server part.

## Checks

On `/bookmarks`, three sample links show. Save `https://example.com`: it appears first and
stays after a reload. Saving it again shows "This link is already saved."
