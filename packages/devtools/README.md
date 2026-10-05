# @bitakit/devtools

A live inspector for one plugin of a running BitaKit app: its pages, its actions (run them with JSON input), its services and their stores, the events it emits and its declared configuration keys (values omitted). New in 0.2; meant for playgrounds and development builds.

```sh
npm install @bitakit/devtools
```

Render it on any page inside the BitaKit provider:

```tsx
'use client';

import { Inspector } from '@bitakit/devtools';

export default function Page() {
  return <Inspector plugin="notes" />;
}
```

Install it as a regular dependency: discovery then adds its styles to the generated `src/bitakit.gen.css`. In a host without discovery, import `@bitakit/devtools/styles.css` yourself. The inspector reads the existing runtime and keeps no copy of plugin state. Plugin packages created with `npx @bitakit/create-app my-plugin --plugin` show it in their playground.

Inventory and lifecycle badges come from `useRuntimeInventory`, the same schema used by App
Preferences and `bitakit info --json`. Declaration sources stay attributable; unavailable data
is not fabricated. Config values/defaults are omitted. Interactive Action execution, service
stores and event inspection keep their existing live APIs and can display application data;
do not treat the entire interactive inspector as a redacted export.


## Runtime diagnostics

`runtime.lifecycle.get()` reports an active `operation` (`start`, `stop`, or `update`)
and its `startedAt` time. Plugin/service entries have `since` timestamps for their current
phase. Compute elapsed time at the observer; Core does not run a diagnostic timer.
`inspectRuntime()` includes those times and cleanup status, without raw errors or values.

| Read | Meaning | Not evidence of |
| --- | --- | --- |
| `inventory.live.slots[].count` | Attached contributions | Mounted or visible UI |
| `mountedOutlets`, `visibleCount`, `renderFailures` | `null`: not observed by Core | Zero outlets or errors |
| `useSlot(name).diagnostics` | This outlet's selected entries and exclusions | Successful render or on-screen visibility |
| `SlotRenderError` / recovery UI | A render failure, attributed to contribution and owner | A failed plugin lifecycle |

Outlet diagnostics name initialization, owner unavailability, update pending, payload
validation/failure, key/condition filtering, hidden/missing Actions and binding errors.
They contain identifiers and counts, never payloads or causes. Read them at the real
outlet; a second diagnostic outlet would have different context.

Devtools `Inspector` shows pending work with elapsed seconds. `stalledAfterMs` changes
its advisory threshold (default 10 seconds). Escalation is reporting/investigating the named
hook, then stopping the host process if necessary. A deadline never completes cleanup,
starts an overlapping replacement, cancels a promise or grants access. Static CLI inventory
continues to return `live: null`.
