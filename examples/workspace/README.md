# Workspace: plugins that work together

Four small plugins in four folders. One owns the feature; three extend it without editing it.
This is how several developers or coding agents work on one app without conflicts.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Notes** and add "Plan launch" and "Write docs". The header shows **2 notes** and
   **Recent activity** lists both.
2. Add "Write docs" again: nothing happens, a guard skipped it.
3. Press **Export as Markdown**: `notes.md` downloads.
4. Delete a note, then press **Mod+K** and type "Write": your note is a search result.
5. Open **Settings → Notes** and turn off **Newest notes first**.

## Who does what

| Plugin     | Owns                                                                                                                  | Uses from notes                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `notes`    | Service `notes.list`, event `notes.changed`, setting, slots `notes.toolbar` and `notes.footer`, a Quick Search source | —                                                                           |
| `activity` | Service `activity.feed`, a footer widget, a header widget                                                             | Listens to `notes.changed`, reads `notes.list`, fills `notes.footer`        |
| `export`   | Action `export.markdown`                                                                                              | Placed in `notes.toolbar`, `requires: ['notes.list']`                       |
| `guard`    | Two interceptors                                                                                                      | Blocks duplicate `notes.add` runs; traces `notes.list` calls in the console |

Delete any of `activity`, `export` or `guard` and the app still works without it.

Guides: [Extend another plugin](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/guides/extend-a-plugin.mdx) ·
[React to another plugin](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/guides/react-to-events.mdx) ·
[Interceptors](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/concepts/interceptors.mdx) ·
[Add a Quick Search source](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/guides/search-source.mdx).
