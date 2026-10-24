# @bitakit/devtools — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/devtools`).
> To change the package itself, follow the repository's own AGENTS.md instead.

Devtools is a live inspector for one plugin of a running app: its pages, Actions (run them with
JSON input), services and their stores, emitted events and declared configuration keys. It is
a library, not a discovered plugin: render it where you need it.

## Use it

```tsx
// src/app/(app)/debug/notes/page.tsx, or a plugin page in development only
'use client';
import { Inspector } from '@bitakit/devtools';

export default function Page() {
  return <Inspector plugin="notes" />;
}
```

- Install it as a normal dependency: discovery adds its styles to `src/bitakit.gen.css`.
- `stalledAfterMs` sets when pending work is marked as slow (default 10 seconds).

## When debugging

- `useSlot(name).diagnostics` at the real outlet explains why a slot is empty: `reason`
  (`empty`, `filtered`, `ambiguous`, `owner-unavailable`, ...), `excluded` entries and, for
  replaceable parts, `candidates`.
- `runtime.lifecycle.get()` shows the active `operation` and per-plugin phases;
  `npx bitakit info --json` prints the static inventory.

## Rules

- It can show application data and run Actions: keep it out of production pages or behind the
  app's own access check.
- Config values are omitted on purpose; do not add them to the page.
