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

## Rules

- Replace template bodies and tutorial comments with the real implementation.
- `bitakit migrate` is the 0.1 upgrade; do not run it to tidy a current project.
- Ask before installing Playwright or test dependencies that commands print.
