# Add a Quick Search source

Requires a version of `@bitakit/quick-search` exporting `SearchSource` from `./sources` and
owning `quick-search.sources`; inspect the installed declarations and `bitakit slots --json`.
Older versions only enumerate navigation Actions.

Keep the addition in the owning plugin's `setup.ts`. Import `SearchSource` from
`@bitakit/quick-search/sources` as a type. Attach it with
`scope.slots.attach({ slot: 'quick-search.sources', id: 'catalog', data: source }, { availability: 'wait' })`
and return its `dispose` cleanup. Set an explicit stable local ID: Core qualifies it with the
plugin owner; that ID keys user preferences and history. Check `scope.slots.has(...)` first for
an optional integration. Do not add a host registry or provider.

A source supplies `title`, `description`, `category: { id, title }`, `defaultEnabled`,
`search(context)` and `resolve(id, context)`. Text is literal/a translation key or `{ key, fallback }`;
its catalogs belong to this plugin. Search receives `query` and `signal`; pass the signal to the
existing authorized API client. It returns filtered/ranked safe links (`{ id, title, href }`) or
existing navigation references (`{ id, actionId }`). Local data can use `score(title, keywords)`.
An empty query may return useful defaults or an empty array. There is no command execution.

`resolve` re-reads a stored result ID against current data and access and returns the same ID or
null. Do not restore a cached URL/title or infer access from stored history. Source/backend and
destination route checks remain mandatory. Sources run independently and obsolete requests are
aborted/ignored. No query is sent to disabled sources.

Quick Search owns preferences/history in Core's Settings store. `defaultEnabled` and existing
`results.*` config switches are initial defaults only; a saved user override wins. Do not create
another settings store or modify persistent preferences for a temporary category filter.

Use the package's shipped `examples/catalog` as a complete local example. Typecheck, run Doctor,
open Mod+K, test source toggling in both Settings and the dialog, slow/error responses, history,
plugin removal and identity changes. Do not add real domain models merely to demonstrate search.
