# Dashboard playground plugin

Owns the `/dashboard` page and the `dashboard.widgets`, `dashboard.stats` and `dashboard.toolbar` slots. `dashboard.open` contributes a navigation link to `shell.navigation`.

Add widgets and toolbar Actions from the contributing feature folder. Keep this page generic; it renders the declared slots.

The two wrapping flex containers own responsive sizing: equal growth per row with a 14rem
stat basis and 16rem widget basis. A lone contribution fills the row; removed contributions
reserve no space. Keep the standard gap and let items shrink to the container on phones.
Contributing plugins do not set dashboard column spans or manage sibling counts.

Shared app conventions and bridge behavior are in `../../../AGENTS.md`. Keep React under
`ui/`, use package APIs, and keep English/German catalog keys aligned where catalogs exist.

Run `npm run typecheck --workspace @bitakit/landing` from the repository root and exercise
this feature in the landing playground, including its disable/enable behavior.
