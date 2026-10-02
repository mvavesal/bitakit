# File contributions and config

Discovery turns a plugin folder into a plugin definition. It runs in Node at build time,
parses files to find default exports without executing them, and writes static imports and
types. Manifests (`plugin.config.ts`) and `bitakit.config.ts` are loaded and must be trusted
code.

## The plugin folder

```text
src/plugins/todos/
├── services/items.ts         defineService   → services.todos.items
├── actions/add.ts            defineAction    → todos.add
├── events.ts                 defineEvents    → todos.changed
├── configs/limits.ts         defineConfig    → app.config.todos.limits
├── interceptors/audit.ts     defineInterceptor
├── setup.ts                  plugin setup (optional)
├── plugin.config.ts          dependencies and metadata (optional)
├── locales/en.json           { "todos": { ... } }
└── ui/
    ├── pages/index.tsx       /todos          (file path = URL)
    ├── pages/tasks/[id].tsx  /todos/tasks/:id
    ├── slots/app-bar.end.tsx component placed in slot "app-bar.end"
    ├── dialogs/rename.tsx    a component an action opens with `dialog`
    └── providers/query.tsx   React provider wrapped around the app
```

Every immediate folder under `src/plugins` is a plugin; the folder name is its ID (lowercase
letters, digits and hyphens). Folders are the one convention: `actions/add.ts` registers
`todos.add`; nested folders add segments (`actions/tasks/clear.ts` → `todos.tasks.clear`).
The legacy spellings `actions.add.ts` and `add.action.ts` (also `form-action`, `dialog-action`,
`service`, `interceptor`, `page`, `view`, `provider` suffixes) and the old `pages/`, `views/` and
`providers/` folders are still read with a warning; `bitakit migrate` rewrites them.

A file participates when it is TypeScript or TSX and has a default export; the parser detects
the export without running the module. Files without a default export are reported and
skipped; prefix helper files with `-` to silence that. `.d.ts` files and anything under
`server/` are never discovered (`server/` is reserved and never reaches the client bundle).
`index.ts` names the parent path (`actions/index.ts` is a collection at the plugin root).
Everything under `ui/` that is not in `pages/`, `slots/` or `providers/` is an ordinary
component, never a contribution; everything under `ui/` is React, and nothing outside it may
import React.

A default export may also be a record of definitions. `actions/index.ts` exporting
`{ add: defineAction(...), clear: defineAction(...) }` equals the two files `actions/add.ts`
and `actions/clear.ts`; nested records nest paths. Interceptor files may export arrays. The
same logical path from two sources is an error that names both files. Class and factory
action exports are no longer discovered.

## The application module

The app itself is a module with the same folders directly under `src/` (change it with
`directory` in `bitakit.config.ts`): `src/actions`, `src/services`, `src/events.ts`,
`src/configs`, `src/interceptors`, `src/setup.ts`, `src/ui/pages`, `src/ui/slots`,
`src/ui/providers`. Its module ID is `app`, its action and service IDs carry no prefix
(`src/actions/reset.ts` → `reset`), and its pages map to the root (`src/ui/pages/about.tsx`
→ `/about`). An optional `src/plugin.config.ts` sets `id`, `dependencies` and `metadata`;
with `{ id: 'app' }` the IDs become `app.reset`.

App-owned routes stay native framework routes (`src/app/**/page.tsx` in Next.js); plugin pages
are rendered by the catch-all route the generator creates. The old `providers/` folder of the
app still needs `providers.enabled` in `bitakit.config.ts`; `src/ui/providers` is included
automatically.

## `plugin.config.ts`

```ts
// src/plugins/todos/plugin.config.ts
export default {
  id: 'todos', // overrides the folder name
  dependencies: ['shell'], // ordered before this plugin; its failure disables this one
  metadata: { name: 'Todos', icon }, // display information; package.json fields are read too
  entries: { actions: './commands', setup: false }, // relocate or disable a kind
};
```

Everything is optional. `entries` points a kind at another folder or file inside the plugin
(`false` disables it); it must stay inside the plugin folder, and symlinks are rejected.

## UI files

- **Pages** export a component; the file path is the URL below `/<plugin>` (`ui/pages/index.tsx`
  → `/todos`, `ui/pages/tasks/[id].tsx` → `/todos/tasks/[id]`). `[param]` segments reach the
  component as `params`. `export const layout = 'blank'` chooses the layout (`app` by
  default). Duplicate or invalid paths fail at startup; the app's own routes win over the
  catch-all.
- **Slots** export a component placed in the slot named by the file (`ui/slots/app-bar.end.tsx`
  → `app-bar.end`); `export const order = 10` sorts within the slot. Layouts render a slot with
  `<PluginSlot name="app-bar.end" />`. Slot names a shell or `bitakit.config.ts` (`slots`)
  declares are typed through `SlotMap`.
- **Providers** export a React provider component wrapped around the app, ID
  `<plugin>.<file>`; `export const requires = ['other.query']` orders it after another one.
- **Dialogs** are plain components an action references: `defineAction({ title: 'Rename', dialog: RenameDialog })`.
  The component receives `{ input, close, services }`.

## Locales

`locales/<lang>.json` holds the plugin's messages under its own namespace:
`{ "todos": { "add": { "title": "Add item" } } }`. Discovery merges every plugin's catalog
into `src/bitakit.gen.messages.json`, which the host passes to its translation provider.
Keys outside the plugin namespace are rejected.

## Config

Each file under `configs/` is the subtree named by its path:

```ts
// configs/limits.ts  →  app.config.todos.limits, config.plugin.get('limits.maxItems')
export default defineConfig({ defaults: { maxItems: 100 } });

// configs/actions/add.ts  →  config.action.get('defaultTitle') inside todos.add
export default defineConfig({ defaults: { defaultTitle: 'Untitled' } });
```

A plain object export is accepted as well. `configs/index.ts` (or `configs.ts`) is the root;
when it carries a schema it must own the complete config and no other config file may exist.
Duplicate leaves from two files are an error, never an override. Overrides live in
`bitakit.config.ts`:

```ts
import { defineBitaKit } from '@bitakit/core/discovery';

export default defineBitaKit({
  configOverrides: { todos: { limits: { maxItems: 50 } } },
});
```

Objects merge recursively, arrays replace, `undefined` keeps the default and `null` is an
explicit value. Unknown plugin IDs are rejected. The resolved config is a frozen snapshot per
runtime, read as `app.config.<plugin>...` or through the `config` context of services and
actions; `usePluginConfig(moduleId, path, fallback)` reads the same snapshot in React.

## Interceptors

Plugin interceptors match only the actions of their own plugin unless `scope: 'global'`.
App interceptors are global unless `scope: 'plugin'`. `order` sorts ascending with stable
ties. Without `interceptors.enabled` in `bitakit.config.ts`, every discovered app interceptor
is active; a list selects them by path, `[]` disables them.

## Generated files

Discovery writes three files into the app directory; add `src/bitakit.gen.*` to `.gitignore`:

| File                            | Contents                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/bitakit.gen.tsx`           | `createBitaKitConfig()`, `BitaKitProvider` and the `ServiceMap`, `ActionMap`, `EventMap`, `CancelableEventMap`, `ConfigMap`, `SlotMap` augmentations (`.ts` without a framework provider) |
| `src/bitakit.gen.css`           | `@import`s of installed package styles, dependencies first and theme last                                                                                                                 |
| `src/bitakit.gen.messages.json` | Plugin locale catalogs, written only when a plugin has `locales/`                                                                                                                         |

The Next adapter (`withBitaKit` in `next.config.ts`) and the TanStack Vite plugin
(`bitakit()`) run the generator before the build and keep regenerating while files change,
including new folders and renames. `bitakit generate [--watch]` runs it by hand. Strict action
IDs are on unless `strict: false`.

## `bitakit.config.ts`

```ts
import { defineBitaKit } from '@bitakit/core/discovery';

export default defineBitaKit({
  directory: './src', // app module root; generated files are written here
  plugins: {
    directory: './src/plugins',
    include: { notes: '../notes/src' }, // plugins outside the project, by ID
    autoEnable: true,
    overrides: { demo: { enabled: false } },
  },
  packages: { '@bitakit/quick-search': false }, // or false to disable package discovery
  configOverrides: { todos: { limits: { maxItems: 50 } } },
  actions: { overrides: { 'todos.add': { enabled: false } } },
  interceptors: { enabled: ['audit'] },
  providers: { enabled: ['query'] }, // only for the legacy providers/ folder
  groups: ['navigation'],
  slots: ['dashboard.content'],
  strict: true,
  framework: 'next', // detected from package.json by default
  kinds: [], // integration contribution kinds
});
```

A disabled plugin contributes nothing: no services, actions, pages, slots or settings.
`actions.overrides` caps an action's `enabled` or `visible`: `false` wins over any reactive
result, `true` never bypasses the action's own guards. Integration kinds (`kinds`, or the
`bitakit.discovery` export of a package) name a folder under `contributions/` of every module
and the normalizer that turns its files into `contributions: { [kind]: values }`.

## Migration

`bitakit migrate --dry-run` lists, and `bitakit migrate` applies: `foundation.config.ts` →
`bitakit.config.ts` with `defineBitaKit`; dotted and suffixed file names → folders; `pages/`,
`views/`, `providers/` → `ui/`; imports of `.foundation/*` and `@bitakit/next/generated` →
`./bitakit.gen`; `defineURLAction` → `defineAction`, `useWatchEvent` → `useEvent`;
`foundation-generate` and `--webpack` out of `package.json` scripts; `.gitignore` entries; and
the old `.foundation/` output is deleted. Review the diff, then run `bitakit generate` and
`bitakit doctor`.

## Source responsibilities

- `discovery/entries.mjs`: one file traversal, path normalizer and default-export detection for every kind.
- `discovery/generate.mjs`: module composition, static imports, types and the generated files.
- `discovery/migrate.mjs`: the 0.1 → 0.2 rewrite.
- `src/discovered.ts`: resolves records and files into the runtime contracts.
- `src/config-service.ts`: resolution, optional schemas and immutable scopes.
- `src/pages.ts`: page, slot and provider normalization and path matching.
- `src/runtime.ts`: lifecycle and integration, no file scanning.

Add a new contribution kind by extending the kind catalog, normalization and generation, not
by scanning files again.
