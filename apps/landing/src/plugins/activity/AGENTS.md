# Activity playground plugin

The `activity.feed` service observes pipeline events and owns the activity feed. UI contributes to `dashboard.widgets` and `shell.header.end`. The heatmap sample data lives under `data/`.

Subscribe through the runtime event API. Keep the header badge and widget driven by the same service state.

Shared app conventions and bridge behavior are in `../../../AGENTS.md`. Keep React under
`ui/`, use package APIs, and keep English/German catalog keys aligned where catalogs exist.

Run `npm run typecheck --workspace @bitakit/landing` from the repository root and exercise
this feature in the landing playground, including its disable/enable behavior.
