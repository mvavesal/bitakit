# Goals playground plugin

Contributes a progress widget to `dashboard.widgets`. `settings.ts` declares the quarter target. `plugin.config.ts` declares the dependency on `pipeline`.

The widget reads the pipeline service and its own runtime setting. Disabling Pipeline also disables this dependent plugin; do not bypass that lifecycle policy.

Shared app conventions and bridge behavior are in `../../../AGENTS.md`. Keep React under
`ui/`, use package APIs, and keep English/German catalog keys aligned where catalogs exist.

Run `npm run typecheck --workspace @bitakit/landing` from the repository root and exercise
this feature in the landing playground, including its disable/enable behavior.
