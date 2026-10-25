# Guard playground plugin

Demonstrates Action interceptors: `interceptors/keep-won.ts` prevents deletion of won deals and `interceptors/trace.ts` observes operations.

This is a local browser demonstration, not server authorization. Preserve the explicit interceptor target and scope; do not move these rules into UI controls.

Shared app conventions and bridge behavior are in `../../../AGENTS.md`. Keep React under
`ui/`, use package APIs, and keep English/German catalog keys aligned where catalogs exist.

Run `npm run typecheck --workspace @bitakit/landing` from the repository root and exercise
this feature in the landing playground, including its disable/enable behavior.
