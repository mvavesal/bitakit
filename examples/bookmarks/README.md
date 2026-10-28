# Bookmarks: data through an API route

Load and save data the BitaKit way: the server owns it in SQLite, an API route checks every
request, and one plugin service keeps the browser's copy with its loading and error states.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. You need Node.js 24: SQLite comes with it as `node:sqlite`, so there is nothing
else to install. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Bookmarks**. Three sample links load from `data/bookmarks.db`, which the server
   creates on the first request.
2. Paste `https://example.com` and press **Save**. The button waits for the server, the link
   appears first and the field clears.
3. Save the same link again: the server answers "This link is already saved." and the list
   stays as it was.
4. Reload the page: your link is still there. **Delete** removes it.
5. Settings → Bookmarks decides whether links open in a new tab.

Delete the `data` folder to start over with the sample links.

## How it fits together

| Part               | File                                       | Job                                              |
| ------------------ | ------------------------------------------ | ------------------------------------------------ |
| Database           | `src/server/database.ts`                   | Opens `data/bookmarks.db`, creates and seeds it  |
| API route (server) | `src/app/api/bookmarks/route.ts`           | Validates input, reads and writes SQLite         |
| Service (browser)  | `src/plugins/bookmarks/services/list.ts`   | Calls the route, holds the list and its `status` |
| Actions            | `src/plugins/bookmarks/actions/*.ts`       | Save, delete, try again: pending and messages    |
| Page               | `src/plugins/bookmarks/ui/pages/index.tsx` | Loading, error, empty and loaded states          |

Server code stays in `src/app/api` and `src/server`; the plugin folder has no server part. The
service changes its store only after the server confirmed a change, so a failed save leaves
the list as it was and the Action shows the server's message.

Guide: [Load and save data through an API](https://github.com/mvavesal/bitakit/blob/main/packages/cli/skills/bitakit-app-development/references/data-and-api.md).
