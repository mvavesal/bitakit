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

## Identifier spelling and extension types

Plugin IDs accept uppercase and lowercase letters. Preserve actual paths and declared names
in generated files and maps. Plugin dependency/parent references and host plugin overrides
resolve exact names first, then an unambiguous case-insensitive match; existing case-only
registrations remain distinct. Ambiguous references need their exact registered spelling.
Package-owned contribution kinds continue to declare their normalizer and type-map entry in
package metadata; read that package's AGENTS.md for its contracts, not a second central guide.
