# @bitakit/cli — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/cli`). To
> change the package itself, follow the repository's own AGENTS.md instead.

The `bitakit` command. It scaffolds plugins and contributions, regenerates the wiring and
checks a project. It also ships the `bitakit-app-development` skill, which `create-app` and
`bitakit init` install into `.agents/skills/` and `.claude/skills/`: read that skill first.

## Commands agents use

| Command                                                    | Does                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npx bitakit add plugin <name>`                            | A plugin with a page and a navigation link (`--example`, `--minimal`)                                 |
| `npx bitakit add <kind> <plugin>/<name>`                   | `action`, `service`, `page`, `interceptor`, `config`, `slot`, `slot-definition`, `dialog`, `provider` |
| `npx bitakit add events\|settings\|settings-page <plugin>` | The plugin's single file of that kind                                                                 |
| `npx bitakit add layout <family>[/<variant>]`              | A candidate for `layout.<family>` (`--plugin <id>` for a plugin)                                      |
| `npx bitakit add test <plugin>`                            | A headless test, plus the setup commands it still needs                                               |
| `npx bitakit info --json`                                  | Plugins, services, Actions, events, settings, pages                                                   |
| `npx bitakit slots [--json]`                               | Every slot, its owner, contributions and, for replaceable parts, what renders                         |
| `npx bitakit doctor [--json]`                              | Wiring, versions, routes, links, slots, replaceable parts, agent files                                |
| `npx bitakit check-page /<path> --json`                    | Opens the page headlessly and reports headings and errors (Playwright)                                |
| `npx bitakit init --update-agent-files`                    | Refreshes AGENTS.md's BitaKit block and unedited skill copies                                         |

`add` never overwrites a file. Run `npm run typecheck` and `npx bitakit doctor` after changes;
doctor exits 1 on errors and names the fix.

`add plugin` (including `--example` and `--minimal`) writes an `AGENTS.md` inside that plugin
and a `CLAUDE.md` importing it. Read the local guide before editing the plugin. Keep its purpose,
contracts and checks there and update them with the code; shared rules stay in the app guide.

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
