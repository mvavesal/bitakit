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

Dots and folders mean the same (`actions.add.ts` equals `actions/add.ts`). Prefix helper files
with `-`. Layout families no package declares become app-owned `layout.<family>` slots.

## `bitakit.config.ts` (next to package.json)

```ts
import { defineBitaKit } from '@bitakit/discovery';

export default defineBitaKit({
  // The occupant of each replaceable (single) slot: '<plugin>', '<plugin>:<key>' or '<key>'.
  choose: { 'layout.auth': 'split', 'screen.not-found': 'brand' },
  plugins: { overrides: { legacy: { enabled: false } } },
  interceptors: { enabled: ['action-log'] },
});
```

## Rules

- Never edit `src/bitakit.gen.*`; change source files and run `npm run typecheck`.
- `npx bitakit info --json` and `npx bitakit slots --json` show what discovery found.

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
`enabled: false`; catalog entries remain `enabled: null` until runtime activation is known.
Nested selected entries resolve browser/import exports at their dependency edge; direct entries
keep package specifiers. Nested custom bundler conditions are not inferred. Historical nonempty
runtime IDs, including numeric-leading build IDs, remain valid static evidence.
`metadataWarnings` and `packageWarnings` are classified subsets of description `warnings`;
never infer a category from a filename or warning text.
