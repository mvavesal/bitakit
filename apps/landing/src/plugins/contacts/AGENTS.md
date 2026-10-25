# Contacts playground plugin

Owns `/contacts`, `contacts.open` and the `contacts.people` service. Adds navigation to `features`, dashboard statistics/widgets and a Quick Search source through `setup.ts`.

Preserve the owned search attachment cleanup and the existing slot availability policy. Keep sample people and signup data under `data/`.

The dashboard statistic uses the shared `StatCard` and next-intl number formatting. Keep
responsive chart placement in the shared component, not in this plugin.

Shared app conventions and bridge behavior are in `../../../AGENTS.md`. Keep React under
`ui/`, use package APIs, and keep English/German catalog keys aligned where catalogs exist.

Run `npm run typecheck --workspace @bitakit/landing` from the repository root and exercise
this feature in the landing playground, including its disable/enable behavior.
