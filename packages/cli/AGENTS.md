# @bitakit/cli — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/cli`). To
> change the package itself, follow the repository's own AGENTS.md instead.

The `bitakit` command. It scaffolds plugins and contributions, regenerates the wiring and
checks a project. It also ships the `bitakit-app-development` skill, which `create-app` and
`bitakit init` install into `.agents/skills/` and `.claude/skills/`: read that skill first.

## Commands agents use

| Command                                                         | Does                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npx bitakit add plugin <name>`                                 | A plugin with a page and a navigation link (`--example`, `--minimal`)                                 |
| `npx bitakit add <kind> <plugin>/<name>`                        | `action`, `service`, `page`, `interceptor`, `config`, `slot`, `slot-definition`, `dialog`, `provider` |
| `npx bitakit add action <plugin>/<name> --server`               | The operation in `server/actions/`, its test, the button and the RPC route when missing               |
| `npx bitakit add service\|interceptor <plugin>/<name> --server` | A file in the plugin's `server/services/` or `server/interceptors/`                                   |
| `npx bitakit add events\|settings\|settings-page <plugin>`      | The plugin's single file of that kind                                                                 |
| `npx bitakit add layout <family>[/<variant>]`                   | A candidate for `layout.<family>` (`--plugin <id>` for a plugin)                                      |
| `npx bitakit add test <plugin>`                                 | A headless test, plus the setup commands it still needs                                               |
| `npx bitakit info --json`                                       | Plugins, services, Actions, events, settings, pages; server entries as `server:<id>`                  |
| `npx bitakit slots [--json]`                                    | Every slot, its owner, contributions and, for replaceable parts, what renders                         |
| `npx bitakit shell [use <name>\|reset] [--part <id>]`           | The app's frame (`layout.app`): candidates, what renders; `use` and `reset` write `choose`            |
| `npx bitakit doctor [--json]`                                   | Wiring, versions, routes, links, slots, replaceable parts, server boundary, agent files               |
| `npx bitakit check-page /<path> --json`                         | Opens the page headlessly and reports headings and errors (Playwright)                                |
| `npx bitakit init --update-agent-files`                         | Refreshes AGENTS.md's BitaKit block and unedited skill copies                                         |

`add` never overwrites a file. Run `npm run typecheck` and `npx bitakit doctor` after changes;
doctor exits 1 on errors and names the fix.

## Server operations

`add action <plugin>/<name> --server` writes `server/actions/<name>.ts`
(`access: 'organization'`, `expose: true`, zod `input`/`output`),
`tests/<plugin>.<name>.server.test.ts` (`mountServer`: a member, a member of another
organization, signed out), the button `actions/<name>.ts` calling `remote.<plugin>.<name>(input)`
when the plugin has none in any spelling, and the RPC route (`src/app/api/rpc/[...path]/route.ts`,
or `src/routes/api/rpc.$.ts` with TanStack Start) when no route calls `fetchHandler`. It prints
what is still missing (`npm install zod`, the test setup, a `requestContext` provider, newer
`@bitakit/core` or `@bitakit/discovery`) and never edits `package.json`. Replace the template bodies. The
`bitakit-app-development` skill's `references/server.md` has the rules.

Doctor fails when browser code (the generated client files, discovered client files, every
`'use client'` file and their value imports) reaches a `server/` folder, `@bitakit/core/server` or
`bitakit.gen.server`, when server code imports React, `@bitakit/ui` or its own `ui/`, and when code
imports the generated server file while no plugin has a server half. It warns when no route
serves exposed operations, when no service provides `requestContext`, and when the installed
discovery does not read `server/` folders.

`add plugin` (including `--example` and `--minimal`) writes an `AGENTS.md` inside that plugin
and a `CLAUDE.md` importing it. Read the local guide before editing the plugin. Keep its purpose,
contracts and checks there and update them with the code; shared rules stay in the app guide.

## Explicit updates

Plain `npx bitakit doctor` reports local health and available updates without installing.
Use `npx bitakit doctor --check-updates` for a focused update report; it is
read-only and supports `--json`. For an authorized BitaKit update, use `npx bitakit doctor
--update` (also `--json`), then run the project's checks. Registry failures do not suppress local health diagnostics; update status is unavailable.
The commands distinguish installed/running versions, latest and range/peer-filtered candidates;
unavailable results are unknown, not current. The native project package manager owns installation.
Updates preserve constraints, skip non-registry specifications and refuse ambiguous release-line
or peer selections. Existing `init --update-agent-files` refreshes through the project-local CLI,
preserving custom skills. External/global CLIs are never overwritten. Do not duplicate lookup
logic in a skill, schedule recurring checks, or ask again for authorization already given.

## Rules

- Replace template bodies and tutorial comments with the real implementation.
- `bitakit migrate` is the 0.1 upgrade; do not run it to tidy a current project.
- Install printed Playwright or test dependencies only within the user's authorized scope;
  obtain missing approval without requesting an authorization already given again.

## Passive package inspection

Info and Doctor read package metadata and static IDs without executing package entries or
discovery hooks. Info JSON adds provenance, package identity, parent, descriptive metadata and
membership to the version-1 inventory. Optional metadata problems warn; contradictory static
IDs in selected copies and conflicting startup IDs are errors. Physical copies remain visible;
unselected copies have `enabled: false` and Doctor reports their selection separately. `bitakit build` adds `pluginId` to its version-1
sidecar, accepts historical nonempty runtime IDs (including numeric-leading IDs), and retains
its npm-name fallback in `metadata.name`. New display titles use `bitakit.title`. Metadata
warnings identify their actual sources; ignored-file warnings stay in the contribution check.
Info text includes runtime plugin IDs and labels unselected physical copies separately from
disabled plugins. JSON includes `selected` and `diagnostics.identityConflicts`; Info and Doctor
use the same passive startup collision evidence. Unknown package versions are never printed
as JavaScript undefined. Inventory record keys can change when packages are hoisted differently.
