# Revenue playground plugin

Contributes dashboard statistics and a revenue chart through `dashboard.stats` and `dashboard.widgets`. `revenue.refresh` joins `dashboard.toolbar`. `services/data.ts` owns the sample revenue data and `settings.ts` declares the chart range.

Keep sample data under `data/`. Refresh uses the existing Action concurrency contract; settings are owned by the runtime.

The dashboard statistic uses the shared `StatCard` and next-intl number formatting. Keep
responsive chart placement in the shared component, not in this plugin.

Shared app conventions and bridge behavior are in `../../../AGENTS.md`. Keep React under
`ui/`, use package APIs, and keep English/German catalog keys aligned where catalogs exist.

Run `npm run typecheck --workspace @bitakit/landing` from the repository root and exercise
this feature in the landing playground, including its disable/enable behavior.
