# Discovery: define a feature, let the build connect it

A growing application should not need another handwritten registration list every
time you add an action or service. BitaKit discovery uses one folder convention to
generate imports, registration, and TypeScript declarations for your configured host.

```text
src/plugins/<id>/ folders + opted-in installed packages
                     │
                     ▼
          Build-time discovery (withBitaKit, bitakit())
                     │
                     ▼
   src/bitakit.gen.tsx, bitakit.gen.css, bitakit.gen.messages.json
                     │
                     ▼
        <BitaKitProvider> mounts the selected plugins
```

## What becomes simpler?

Every folder under `src/plugins` is a plugin. Its `services/`, `actions/`, `events.ts`,
`configs/`, `interceptors/`, `setup.ts` and `ui/` (pages, slots, providers) supply the
definitions; discovery connects them and derives IDs from the paths: `actions/add.ts` in
`todos` is `todos.add`, `services/items.ts` is `services.todos.items`, `ui/pages/index.tsx`
is `/todos`. You keep writing feature behavior without maintaining a parallel list of every
contribution. `bitakit.config.ts` holds host overrides, and `bitakit migrate` rewrites the
0.1 spellings.

Installed packages participate only when their `package.json` declares `bitakit.plugin`.
Installing an arbitrary npm dependency does not activate it as a plugin. Explicit
registration remains available, as in the To-do tutorial.

## What about settings?

App Preferences supplies discovery descriptors for settings, sections, and renderers.
When that package is installed, those definitions join the generated composition. The
Settings catalog remains the owner of the registered sections.

Discovery does not invent settings, persistence, or permissions. You still define the
contributions and configure their storage. Server-backed settings also need server
registration and authorization; finding a UI file does not grant access to data.

## Where does it run?

Discovery runs at build time in Node, not by scanning the filesystem in the browser.
The framework adapter watches contribution files during development and regenerates the
files; production changes need a rebuild and deployment. Core installation alone does not
enable a watcher. `bitakit info` lists what discovery finds; `bitakit doctor` checks the
wiring.

Start with the [To-do example](../../packages/core/docs/todo-tutorial.md), then follow
[the file conventions](../../packages/core/docs/file-contributions.md) when moving to
a discovery-enabled host.
