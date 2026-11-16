# @bitakit/discovery — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/discovery`).
> To change the package itself, follow the repository's own AGENTS.md instead.

Node-only discovery: it scans `src/` (the app), `src/plugins/<id>/` and installed plugin
packages, then writes the typed wiring `src/bitakit.gen.*`. The framework adapter runs it; agents
only need its file conventions and `bitakit.config.ts`.

## File conventions (the path is the ID)

| File                                                 | Becomes                                                   |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `src/plugins/notes/actions/add.ts`                   | Action `notes.add`                                        |
| `src/plugins/notes/services/list.ts`                 | Service `notes.list`                                      |
| `src/plugins/notes/ui/pages/index.tsx`               | Page `/notes`                                             |
| `src/plugins/notes/ui/slots/shell.header.end.tsx`    | A component in the slot `shell.header.end`                |
| `src/layouts/auth.tsx`, `src/layouts/auth/split.tsx` | Candidates for `layout.auth` (variant `default`, `split`) |
| `src/plugins/brand/ui/layouts/auth/brand.tsx`        | A plugin's candidate for `layout.auth`                    |
| `src/themes/<id>.json`                               | An app theme (with `@bitakit/shell`)                      |
| `src/plugins/notes/server/actions/add.ts`            | Server Action `notes.add` (`server:notes.add` in tools)   |
| `src/plugins/notes/server/services/store.ts`         | Server service `notes.store`                              |
| `src/server/services/request-context.ts`             | The app's server service `request-context`                |

Dots and folders mean the same (`actions.add.ts` equals `actions/add.ts`). Prefix helper files
with `-`. Layout families no package declares become app-owned `layout.<family>` slots.

## The server half

- After the leading `server` segment, `server/actions`, `server/services`, `server/interceptors`
  and `server/contributions/<directory>` follow the client's spellings (folders, dotted files,
  record files). Every other file under `server/` is the module's own code and stays silent.
- While an enabled module has server content, discovery writes `src/bitakit.gen.server.ts`:
  `createBitaKitServerConfig()` (every enabled local module's shared `events.ts`, `settings.ts`,
  `permissions.ts`, `configs/` and its `server/` files; no package plugins) and
  `export const server = createServer(...)`, plus the `ServerActionMap` and `ServerServiceMap`
  types. Without server content the file is removed. The client file then gets
  `remote: { endpoint, operations }` with the exposed operation IDs.
- Generation fails, naming the file, when a server Action has a client-only field, no `access`, an
  `expose` that is not a boolean literal or a reserved name (`then`, `subscribe`, `toJSON`, ...),
  when two server Actions differ only in case, and when a client Action has `access`, `expose` or
  `output`. It also fails when the installed `@bitakit/core` has no `./server` entry (0.3.2 or
  later is needed).
- A contribution kind may declare `runtime`: `client` (default, `contributions/<directory>`),
  `server` (`server/contributions/<directory>`, imported only by the server file) or `both`
  (`contributions/<directory>`, imported by both files). A file on the wrong side is a generation
  error naming the path it belongs at.
- `bitakit.config.ts` `server: { endpoint: '/api/bitakit' }` moves the RPC endpoint (default
  `/api/rpc`) for the server file and `remote`.

## `bitakit.config.ts` (next to package.json)

```ts
import { defineBitaKit } from '@bitakit/discovery';

export default defineBitaKit({
  // The occupant of each replaceable (single) slot: '<plugin>', '<plugin>:<key>' or '<key>'.
  choose: { 'layout.auth': 'split', 'screen.not-found': 'brand' },
  plugins: { overrides: { legacy: { enabled: false } } },
  interceptors: { enabled: ['action-log'] },
  server: { endpoint: '/api/rpc' }, // the default
});
```

## Rules

- Never edit `src/bitakit.gen.*`; change source files and run `npm run typecheck`.
- Never import `src/bitakit.gen.server.ts` from browser code; only the RPC route and other server
  code do.
- `npx bitakit info --json` and `npx bitakit slots --json` show what discovery found.

## Identifier spelling and extension types

Plugin IDs accept uppercase and lowercase letters. Preserve actual paths and declared names
in generated files and maps. Plugin dependency/parent references and host plugin overrides
resolve exact names first, then an unambiguous case-insensitive match; existing case-only
registrations remain distinct. Ambiguous references need their exact registered spelling.
Package-owned contribution kinds continue to declare their normalizer and type-map entry in
package metadata; read that package's AGENTS.md for its contracts, not a second central guide.

## Package metadata and grouping

Keep descriptive package fields in package.json. `bitakit.title`, `tags` and `coverImage` are
canonical for installed packages; top-level legacy tags/images and plugin code remain fallbacks.
Local and included folders preserve their `plugin.config.ts` metadata precedence. `bitakit.memberOf: ['*']` declares general purpose; explicit bundle
IDs declare membership. Missing membership is unspecified. Local membership is derived from
the application's `bitakit.bundle` or package name. `bundles: [{ id, label? }]` in host config
labels known external bundles. Names compare lowercase without dropping scopes.

Use `bitakit.id` or a rebuilt entry's sidecar to expose its static runtime ID. Contradictory
manifest/sidecar IDs and known active collisions fail before entry import. Legacy entries with
no static ID remain supported. `describeBitaKit(root, { packageMetadataOnly: true })` skips
package discovery hooks and stylesheet auditing; `auditPackageStyles: true` retains the audit.
No package entry is executed. Upgrade Core and Discovery together.

Physical copies stay in inspection; `packagePlugins[entry].selected` identifies build selection.
Selection preserves the first lowercase package name reached from sorted root dependencies,
then breadth-first dependencies of selected packages. Unselected copies and dependencies only
reachable through them do not activate plugins, hooks, styles or slots. CLI inventory marks them
`enabled: false` and `selected: false`; info distinguishes them from disabled local plugins.
Catalog entries remain `enabled: null` until runtime activation is known. Physical inventory
keys can change with hoisting; use package identity or pluginId for logical identity.
Nested selected entries resolve browser/import exports at their dependency edge; direct entries
keep package specifiers. Nested custom bundler conditions are not inferred. Historical nonempty
runtime IDs, including numeric-leading build IDs, remain valid static evidence.
`metadataWarnings` and `packageWarnings` are classified subsets of description `warnings`;
never infer a category from a filename or warning text.

Runtime artifact preparation may reuse `resolvePluginEntry(specifier, manifestFile)` for the
existing browser/import resolution and `staticPluginId(name, metadata, sidecar)` for manifest/
sidecar agreement. Both are static checks; neither evaluates plugin code or installs packages.

Catalog selection accepts a dependency alias or its canonical package name. Generated catalog
keys retain the selected spelling; listing both names loads the definition only once. Provenance
always retains the canonical package name. Nested TypeScript source entries use extensionless
generated imports. Code and CSS follow the selected physical copy, which may differ from the
hoisted version older bare imports accidentally executed. The app module does not acquire its
npm name as a display label; its existing default/explicit labels remain intact.
