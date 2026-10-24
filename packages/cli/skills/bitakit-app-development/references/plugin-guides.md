# Keep a plugin's guide with its code

Read the owning plugin's `AGENTS.md` before extending it. `bitakit add plugin` writes one
beside its source and a `CLAUDE.md` containing only `@AGENTS.md`. Standalone plugin packages
have these files at the package root. Discovery ignores both Markdown files.

## What to maintain

Keep the actual purpose, public IDs and payloads, extension points, non-obvious constraints
and relevant checks with that plugin. Update changed facts in the same task as the code.
Remove superseded descriptions rather than appending a second version of the contract.

Do not invent contracts to fill headings. A page-only plugin needs no service documentation.
An internal refactor that preserves the documented behavior may need no guide change.
Preserve team-authored instructions and keep shared BitaKit rules in the app's guide and skill.
The app-root `init --update-agent-files` refresh does not maintain plugin guides for you.

## Example: document the Bookmarks feature

After implementing [worked-example.md](worked-example.md), replace the generated starter
description in `src/plugins/bookmarks/AGENTS.md` with the implemented feature's facts:

```markdown
# Bookmarks

Save links, open them and remove them from `/bookmarks`.

## Public contracts

- `bookmarks.list` (`services/list.ts`) owns in-memory `bookmarks` with `id`, `title` and
  `url`. Its `add(url)` and `remove(id)` methods update the store and emit events.
- `bookmarks.add` takes a URL string; `bookmarks.remove` takes an ID and asks for confirmation.
  `bookmarks.open` links to `/bookmarks` in `shell.navigation`.
- `bookmarks.added` carries `{ id, url }`; `bookmarks.removed` carries `{ id }`.
- `bookmarks.openInNewTab` controls how links open; App Preferences renders the setting at
  `/settings/bookmarks`.

## Constraints and checks

The list is in browser memory and resets on reload. The `openInNewTab` preference uses the
app's settings storage. This version has no server persistence or access-control contract.

From the app root, run its typecheck and `npx bitakit doctor`; run the Bookmarks test when
the documented test setup is installed. In `/bookmarks`, save a URL and confirm removal.
Change `openInNewTab` in Settings and check the link's target.
```

The example describes only the in-memory version. After following the API recipe, update
the ownership and persistence paragraph, the `reload` Action and its checks to match that
implementation. A server-memory example still resets on server restart; do not call it a
durable database.

## Example: extend one feature from another

If a new `sharing` plugin calls `bookmarks.list` and contributes a toolbar Action:

- `sharing/AGENTS.md` describes its Action, required service, target slot and checks.
- `bookmarks/AGENTS.md` changes only if Bookmarks gains a public contract, such as a new
  owned slot with an actual outlet. Document the slot's ID and accepted contribution there.
- The general app guide and skill keep the ownership rule; neither becomes a catalog of
  `sharing` or `bookmarks` internals.

Keep `CLAUDE.md` as the import; edit the shared instructions in `AGENTS.md` once.
