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
canonical; top-level legacy tags/images and plugin code remain fallbacks. Local plugin metadata
stays in `plugin.config.ts`. `bitakit.memberOf: ['*']` declares general purpose; explicit bundle
IDs declare membership. Missing membership is unspecified. Local membership is derived from
the application's `bitakit.bundle` or package name. `bundles: [{ id, label? }]` in host config
labels known external bundles. Names compare lowercase without dropping scopes.

Use `bitakit.id` or a rebuilt entry's sidecar to expose its static runtime ID. Contradictory
manifest/sidecar IDs and known active collisions fail before entry import. Legacy entries with
no static ID remain supported. `describeBitaKit(root, { packageMetadataOnly: true })` skips
package discovery hooks and stylesheet auditing; `auditPackageStyles: true` retains the audit.
No package entry is executed. Upgrade Core and Discovery together.
