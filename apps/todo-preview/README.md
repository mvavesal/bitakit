# todo-preview

A Next.js app built with [BitaKit](https://github.com/mvavesal/bitakit).

```sh
npm run dev        # start the dev server
npm run build      # production build
npm run typecheck  # types, including generated plugin types
```

## Add a feature

```sh
npx bitakit add plugin notes
```

This creates `src/plugins/notes/` with a service, typed events, actions, a navigation link and
a page at `/notes`. The dev server picks it up automatically: there is no registry to edit.
A plugin can also be a single file: `src/plugins/notes/ui/pages/index.tsx` is already a page at
`/notes`; add services and actions when the feature needs behavior.

The `todos` plugin in `src/plugins/todos` is a working sample. Delete the folder to remove it.

| Folder | What goes there |
| --- | --- |
| `src/plugins/<name>/services` | Data and behavior (`defineService`), reached as `services.<name>.<file>` |
| `src/plugins/<name>/actions` | Operations for buttons, menus and links (`defineAction`), ID `<name>.<file>` |
| `src/plugins/<name>/events.ts` | Typed events (`defineEvents`), named `<name>.<event>` |
| `src/plugins/<name>/settings.ts` | User settings (`defineSettings`), keys `<name>.<setting>`, with a generated page under `/settings` |
| `src/plugins/<name>/ui/pages` | Pages; the file path is the URL (`ui/pages/index.tsx` → `/<name>`) |
| `src/plugins/<name>/ui/slots` | Components placed in layout slots (`ui/slots/app-bar.end.tsx`) |
| `src/app` | Your own routes, as usual for the framework |
| `src/configs/shell.ts` | App Shell options |

Check the project at any time:

```sh
npx bitakit doctor
```

Settings are at `/settings`. Preferences are stored in the browser.
