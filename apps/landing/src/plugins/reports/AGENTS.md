# Reports playground plugin

Owns `/reports` and `reports.open`, placed in the `features` navigation slot. The page renders
the monthly sample data with the standard Table and next-intl formatting. Currency comes from
the existing app setting; no local settings or value store is needed.

Keep sample snapshots under `data/`, React under `ui/`, and English/German UI keys aligned.
Use the shared app rules in `../../../AGENTS.md`. Verify the page, currency/language changes
and disable/enable behavior with `npm run typecheck --workspace @bitakit/landing` and the demo.
