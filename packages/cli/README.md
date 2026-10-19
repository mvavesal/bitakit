# @bitakit/cli

The `bitakit` command for BitaKit projects: wire an existing app, add plugins and their files
from templates, generate the wiring, migrate a 0.1 project, check a project for common problems,
and build plugin packages. New in 0.2.

Apps created with `@bitakit/create-app` 0.2 already include it as a dev dependency. Elsewhere:

```sh
npm install --save-dev @bitakit/cli
```

Run it with `npx bitakit <command>` when installed, or
`npx @bitakit/cli@latest <command>` to use the latest published CLI directly.

## Wire an existing app

```sh
npx @bitakit/cli@latest init
```

In an existing Next.js or TanStack Start app, `init` writes `bitakit.config.ts`, wraps
`next.config` with `withBitaKit` (or adds `bitakit()` to the Vite plugins), mounts
`<BitaKitProvider>` around `{children}` of the root layout, adds the catch-all route that renders
`<PluginPage />`, ignores `src/bitakit.gen.*`, appends the agent rules to `AGENTS.md` and makes `CLAUDE.md` import it (an existing `CLAUDE.md` only gains the `@AGENTS.md` line). It also delivers the
`bitakit-app-development` skill in the native project folders for Codex and Claude Code; existing
skills at either path are preserved (see [Keep agent files current](#keep-agent-files-current)). It prints what it wrote (`+` new file, `~` changed file) and what
it skipped. Files that already carry the wiring are never touched, so it
is safe to run again; a shape it cannot edit (for example a CommonJS `next.config.js`) is
skipped with the line to add by hand. Packages are not installed: `init` lists the missing ones
(`@bitakit/core`, `@bitakit/discovery`, `@bitakit/ui` and the framework adapter, plus `@bitakit/cli`
as a dev dependency for the `bitakit` command). Then run `generate` and `doctor`.
`create-bitakit-app` writes the same wiring for new apps from the same templates.

The skill (`SKILL.md` and its `references/` recipes) is copied to `.agents/skills/` for Codex and
most other agents and to `.claude/skills/` for Claude Code. `create-app` 0.2.2 and later include it
in new apps; `npx @bitakit/create-app .` creates the app in a folder that holds only `.git` and
agent files, so the skill lands where an open agent session works. See the [skill README](skills/bitakit-app-development/README.md) for how to use it
and requests to try.

## Update BitaKit

Keep every `@bitakit/*` package on one release line (0.2.x, then 0.3.x). Only packages whose
shipped content changed get a patch release, so patch versions may differ within a line; `doctor`
accepts that and reports packages on different lines as an error.

Within a line, `npm update` installs the newest patches the caret ranges allow. Name the
`@bitakit/*` packages your `package.json` lists (plain `npm update` updates every dependency):

```sh
npm update @bitakit/core @bitakit/ui @bitakit/next @bitakit/cli @bitakit/discovery
```

`package.json` keeps its ranges; `package-lock.json` records the new versions.

A new line is outside those ranges. Install all `@bitakit/*` packages at it in one command, here
0.3; each keeps its place in `dependencies` or `devDependencies`:

```sh
npm install @bitakit/core@0.3 @bitakit/ui@0.3 @bitakit/next@0.3 @bitakit/cli@0.3 @bitakit/discovery@0.3
```

Do not move one package alone (for example `npm install --save-dev @bitakit/cli@latest`): once a
new line is out, that splits the app across two lines. Follow the new line's upgrade guide when
it has one, then refresh the agent files and check the project:

```sh
npx bitakit init --update-agent-files
npx bitakit doctor
```

### Keep agent files current

The installed `SKILL.md` records the CLI version and a checksum of the files as shipped in its
frontmatter `metadata`. After updating the BitaKit packages, run:

```sh
npx bitakit init --update-agent-files
```

It installs a missing skill copy, replaces a copy nobody edited with this version's skill, and
replaces the BitaKit block of `AGENTS.md` (between its `bitakit-agent-rules` markers) with the
current rules; keep your own rules above or below that block. A skill copy you edited is
kept and reported; delete its folder and run the command again to take the new version. `doctor`
warns when a copy is missing or older than the installed CLI, when the two copies differ, or when
the `AGENTS.md` block differs from the current rules.

## Add a feature

```sh
npx bitakit add plugin notes
```

This creates `src/plugins/notes/` with a page at `/notes` and, with Shell, its navigation
Action; discovery connects it, so there is nothing to register. `--example` writes a complete
feature (the service `notes.list`, events, Actions, page); `--minimal` only that service, its
events and one action.

Add single files to an existing plugin (inside a plugin package, give only the name):

```sh
npx bitakit add action notes/archive        # actions/archive.ts        → notes.archive
npx bitakit add service notes/search        # services/search.ts       → services.notes.search
npx bitakit add page notes/archive          # ui/pages/archive.tsx      → /notes/archive
npx bitakit add interceptor notes/audit     # interceptors/audit.ts
npx bitakit add config notes/limits         # configs/limits.ts         → app.config.notes.limits
npx bitakit add events notes                # events.ts
```

The file path decides the ID; nested names such as `notes/team/invite` create
`actions/team/invite.ts` with the ID `notes.team.invite`. Existing files are never overwritten.

In an app, add a headless test for an existing plugin:

```sh
npx bitakit add test notes                  # tests/notes.test.ts at the app root
```

The test mounts `src/plugins/notes` with `mountPlugin` from `@bitakit/core/testing`, checks that
the plugin starts, then stops it; a stand-in for Shell is included when the plugin places Actions
in `shell.*` slots. The command prints the setup the app still lacks as commands (missing dev
dependencies, `"type": "module"`, a `test` script) and never edits `package.json`.

## Generate and migrate

```sh
npx bitakit generate            # write src/bitakit.gen.* from the plugin folders and installed packages
npx bitakit generate --watch    # keep regenerating while files change
npx bitakit migrate --dry-run   # list the changes from a 0.1 layout
npx bitakit migrate             # apply them: bitakit.config.ts, folder-only files, ui/, generated imports,
                                # setup({ scope }), placement slot, slots.attach({ slot }), Foundation* →
                                # BitaKit* names and Core names moved from @bitakit/ui to @bitakit/core
```

The framework adapters run the generator themselves during `dev` and `build`; `generate` is for
scripts and type checks. After a migration, review the diff, then run `generate` and `doctor`.
The migrated `bitakit.config.ts` imports `defineBitaKit` from `@bitakit/discovery`; install it as a
dev dependency if the project does not list it yet.

## Check a project

```sh
npx bitakit doctor          # human-readable report, exit code 1 on problems
npx bitakit doctor --json   # for CI
npx bitakit info [--json]   # the plugins, services, actions, events and pages discovery finds
npx bitakit slots [--json]  # every slot you can fill: owner, accepts and this app's contributions
```

Doctor checks package versions, duplicate copies of `@bitakit/core`, the config wrapper and
provider wiring, scripts that still force Webpack or `foundation-generate`, ignored generated
files, plugin pages and links no route reaches, colliding service names, `requires` entries that
name nothing, plugin dependency cycles, missing package styles, deprecated layouts and agent files
that are out of sync, and prints a fix for each problem.

The `requires` check reads the string literals of `requires` in services, actions, interceptors
and in `export const requires` of provider files. A name must be a service ID, an `exposeAs`
alias or the contract of a `provides` key of the app or a local plugin. Dotted names inside a
local plugin's namespace (`notes.list`) are checked exactly, including against plugins turned
off in `plugins.overrides`. Other names, such as the contract `auth`, can come from installed
plugin packages, from host `services` or from keys declared in other files, which doctor cannot
list, so they are only checked when none of those exist. The graph check reports a cycle in the `dependencies` of
`plugin.config.ts` as an error and enabled plugins that depend on disabled ones as a warning.

## Check a page in a headless browser

Plugin pages and slots render only in the browser, so an HTTP 200 proves nothing. With the dev
server running, `check-page` opens a page in headless Chromium and reports what rendered:

```sh
npx bitakit check-page /todos         # against --base-url, default http://localhost:3000
npx bitakit check-page /todos --json  # { "version": 1, ... } for agents and CI
npx bitakit check-page http://localhost:3230/todos --screenshot todos.png --timeout 60000
```

It waits for the network to go idle and for the BitaKit runtime to finish starting
(`<html data-bitakit-runtime>`, set by `@bitakit/ui`), then reports the final URL, HTTP status,
title, h1–h3 headings, a short excerpt of `<main>`, the runtime state, BitaKit errors (the
`[bitakit]` console errors: startup failures, such as a plugin turned off in development, and
other runtime errors), console
errors and warnings, page errors and failed same-origin requests. It exits with 1 when it saw
any error (warnings do not count) and 0 otherwise. `--timeout` (default 30000 ms) covers loading
and startup. The JSON report has `url`, `finalUrl`, `status`, `title`, `headings`, `text`,
`textSource`, `runtime` (`ready`, `starting`, `failed`, or `null` without a BitaKit provider),
`networkIdle`, `loadError`, `bitakitErrors`, `consoleErrors`, `consoleWarnings`, `pageErrors`,
`failedRequests`, `screenshot`, `errors` and `ok`.

The catch-all route answers unknown paths with status 200 and a "Page not found" state, so
read the headings as well as the exit code.

`check-page` uses the project's own Playwright (`playwright` or `@playwright/test`) and never
installs anything. Without it, it exits with 2 and prints the commands to run:

```sh
npm install --save-dev playwright
npx playwright install chromium
```

On Linux (containers, CI) install Chromium with its system libraries:
`npx playwright install --with-deps chromium`. A browser that cannot start also exits with 2.

## Build a plugin package

Inside a package created with `npx @bitakit/create-app my-plugin --plugin`:

```sh
npx bitakit build          # types, compiled sources and dist/plugin.js
npx bitakit build --check  # type-check only
```

The package's `package.json` declares `bitakit: { plugin: './plugin' }`; apps that install the
built package discover the plugin automatically.

### Slot declaration or UI contribution

```sh
bitakit add slot-definition notes/header/tools  # slots/header/tools.ts, owned by notes
bitakit add slot notes/app-bar/end              # ui/slots/app-bar/end.tsx, contributes UI
```

In a plugin package, omit the plugin prefix. `bitakit build` compiles definitions and augments
`SlotMap`; the generated `dist/plugin.slots.json` is a derived static inventory for Doctor.
Keep it with the published entry. Doctor reports duplicate contracts, component/contract
mismatches and unresolved computed records without executing plugin source. It does not prove
that a UI outlet is mounted or that a plugin is ready.

`bitakit build` preserves `settings.ts` and `ui/settings/page.tsx` in the package factory and
emits SettingsMap augmentations. Custom/extra page descriptors, named page boundaries and
slot `when` exports pass through the same normalizers used for local app discovery.

## Inspection and explicit placement migration

`bitakit info` and `bitakit info --json` use the shared inventory schema:

```json
{ "version": 1, "static": { "plugins": [] }, "live": null }
```

This replaces the old raw discovery JSON. Files remain `resolution: "file"` with an unavailable
ID until resolved; installed package entrypoints can have `pluginId`/`declarations: null`.
The CLI does not execute plugins to invent live readiness. Config and Settings values are omitted.

`bitakit slots` answers "where can I put this?". It lists the slot contracts of the app, its
enabled plugins and installed packages (from their `*.slots.json`), plus name hints from package
manifests and `bitakit.config.ts`: the same set doctor counts. The human output groups them by
owner, one line per slot with what it accepts and its contribution count. `--json` prints:

```json
{
  "version": 1,
  "slots": [
    {
      "id": "todos.footer",
      "owner": "todos",
      "plugin": "todos",
      "contract": true,
      "accepts": "component",
      "policy": "list",
      "payload": false,
      "payloadKeys": [],
      "source": "src/plugins/todos/slots/footer.ts",
      "contributions": [
        {
          "kind": "component",
          "id": null,
          "plugin": "activity",
          "source": "src/plugins/activity/ui/slots/todos.footer.tsx"
        }
      ]
    }
  ],
  "unresolved": [],
  "unknownTargets": []
}
```

`owner` is the plugin ID of a local slot or the package name of an installed one; name hints
have `contract: false`. `payloadKeys` are read from a literal `z.object({ ... })` (or another
`.object({ ... })` schema). Contributions come from the app's own files: `ui/slots` components and
Actions whose literal `slots` list names the slot; packages and `setup()` attach theirs at runtime.
Nothing is executed. A value the files do not state literally is `null` (package payloads, for
example), and files that could not be read are listed in `unresolved`. `unknownTargets` lists
contributions to a slot nobody declares (`{ slot, kind, id, plugin, source }`), such as a misspelled
name; they render nowhere. The human output lists both after the slots.

```sh
bitakit add slot-definition notes/toolbar
bitakit add settings-page notes
bitakit migrate --navigation-slot shell.navigation --dry-run
# Review the diff before running the same explicit migration without --dry-run.
bitakit doctor
```

Doctor warns about literal `groups: ['navigation']` Actions without explicit placement when
Shell is installed. The opt-in migration adds the chosen `slots` target and retains logical
groups. It skips spread-based ambiguous objects; imported/computed declarations require manual
review. No group name is automatically reinterpreted as a slot. Migration scans the app source
root; externally included plugin directories require their own review. For a legacy 0.1 layout,
finish/review the layout migration before previewing placement changes.

`settings-page` writes `ui/settings/page.tsx` and uses the existing `renderField` callback;
`@bitakit/app-preferences` must be installed. It creates neither a value store nor navigation
Actions. Templates never overwrite existing files.
