# Tasks playground plugin

Owns `/tasks`, `tasks.open`, `tasks.toggle` and the `tasks.list` service. The service owns the
session-only task state; the Action owns completion/reopening and its current label. The page
uses the generic Action binding with standard Item, Badge and Button components.
The navigation Action uses Reicon Outline ClipboardList; the completion Action keeps Check.

Keep sample data under `data/`, React under `ui/`, and English/German UI keys aligned.
Follow `../../../AGENTS.md`. Do not add a parallel state store or persistence. Verify completion,
reopening and disable/enable behavior with `npm run typecheck --workspace @bitakit/landing`
and the demo; re-enabling starts the sample state again.
