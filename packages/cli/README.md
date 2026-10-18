# @bitakit/cli

The `bitakit` command for BitaKit projects: wire an existing app, add plugins and their files
from templates, generate the wiring, migrate a 0.1 project, check a project for common problems,
and build plugin packages. New in 0.2.

Apps created with `@bitakit/create-app` 0.2 already include it as a dev dependency. Elsewhere:

```sh
npm install --save-dev @bitakit/cli
```

Run it with `npx bitakit <command>` inside your app or plugin package.

## Wire an existing app

```sh
npx bitakit init
```

In an existing Next.js or TanStack Start app, `init` writes `bitakit.config.ts`, wraps
`next.config` with `withBitaKit` (or adds `bitakit()` to the Vite plugins), mounts
`<BitaKitProvider>` around `{children}` of the root layout, adds the catch-all route that renders
`<PluginPage />`, ignores `src/bitakit.gen.*`, appends the agent rules to `AGENTS.md` and makes `CLAUDE.md` import it (an existing `CLAUDE.md` only gains the `@AGENTS.md` line). It also delivers the
`bitakit-app-development` skill at `.agents/skills/bitakit-app-development/SKILL.md`; an existing
skill at that path is preserved. It prints what it wrote (`+` new file, `~` changed file) and what
it skipped. Files that already carry the wiring are never touched, so it
is safe to run again; a shape it cannot edit (for example a CommonJS `next.config.js`) is
skipped with the line to add by hand. Packages are not installed: `init` lists the missing ones
(`@bitakit/core`, `@bitakit/discovery`, `@bitakit/ui` and the framework adapter). Then run `generate` and `doctor`.
`create-bitakit-app` writes the same wiring for new apps from the same templates.

## Add a feature

```sh
npx bitakit add plugin notes
```

This creates `src/plugins/notes/` with a page at `/notes` and, with Shell, its navigation
Action; discovery connects it, so there is nothing to register. `--example` writes a complete
feature (service, events, Actions, page); `--minimal` only a service, its events and one action.

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
```

Doctor checks package versions, duplicate copies of `@bitakit/core`, the config wrapper and
provider wiring, scripts that still force Webpack or `foundation-generate`, ignored generated
files, plugin pages and links no route reaches, colliding service names, `requires` entries that
name nothing, plugin dependency cycles, missing package styles and deprecated layouts, and prints
a fix for each problem.

The `requires` check reads the string literals of `requires` in services, actions, interceptors
and in `export const requires` of provider files. A name must be a service ID, an `exposeAs`
alias or the contract of a `provides` key of the app or a local plugin. Dotted names inside a
local plugin's namespace (`notes.items`) are checked exactly, including against plugins turned
off in `plugins.overrides`. Other names, such as the contract `auth`, can come from installed
plugin packages, from host `services` or from keys declared in other files, which doctor cannot
list, so they are only checked when none of those exist. The graph check reports a cycle in the `dependencies` of
`plugin.config.ts` as an error and enabled plugins that depend on disabled ones as a warning.

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
