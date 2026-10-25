# Pipeline playground plugin

Owns `/pipeline`, `pipeline.open`, `pipeline.add`, `pipeline.win`, `pipeline.remove` and the `pipeline.deals` service. Contributes dashboard statistics/widgets and an add Action to `dashboard.toolbar`. `events.ts` declares `pipeline.added`, `pipeline.won` and `pipeline.removed`.

Keep mutations in the deals service, execution/guards in Actions and sample data under `data/`. Other plugins respond through events and slots, without editing this folder.

The dashboard statistic uses the shared `StatCard` and next-intl number formatting. Keep
responsive chart placement in the shared component, not in this plugin.

Shared app conventions and bridge behavior are in `../../../AGENTS.md`. Keep React under
`ui/`, use package APIs, and keep English/German catalog keys aligned where catalogs exist.

Run `npm run typecheck --workspace @bitakit/landing` from the repository root and exercise
this feature in the landing playground, including its disable/enable behavior.
