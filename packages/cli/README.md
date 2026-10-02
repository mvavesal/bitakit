# @bitakit/cli

The `bitakit` command for BitaKit projects: add plugins and their files from templates,
generate the wiring, migrate a 0.1 project, check a project for common problems, and build
plugin packages. New in 0.2.

Apps created with `@bitakit/create-app` 0.2 already include it as a dev dependency. Elsewhere:

```sh
npm install --save-dev @bitakit/cli
```

Run it with `npx bitakit <command>` inside your app or plugin package.

## Add a feature

```sh
npx bitakit add plugin notes
```

This creates `src/plugins/notes/` with a service, typed events, actions, a navigation link and
a page at `/notes`; discovery connects it, so there is nothing to register. `--minimal` creates
only the service, the events and one action.

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
npx bitakit migrate             # apply them: bitakit.config.ts, folder-only files, ui/, generated imports
```

The framework adapters run the generator themselves during `dev` and `build`; `generate` is for
scripts and type checks. After a migration, review the diff, then run `generate` and `doctor`.

## Check a project

```sh
npx bitakit doctor          # human-readable report, exit code 1 on problems
npx bitakit doctor --json   # for CI
npx bitakit info [--json]   # the plugins, services, actions, events and pages discovery finds
```

Doctor checks package versions, duplicate copies of `@bitakit/core`, the config wrapper and
provider wiring, scripts that still force Webpack or `foundation-generate`, ignored generated
files, plugin pages and links no route reaches, colliding service names, missing package styles
and deprecated layouts, and prints a fix for each problem.

## Build a plugin package

Inside a package created with `npx @bitakit/create-app my-plugin --plugin`:

```sh
npx bitakit build          # types, compiled sources and dist/plugin.js
npx bitakit build --check  # type-check only
```

The package's `package.json` declares `bitakit: { plugin: './plugin' }`; apps that install the
built package discover the plugin automatically.
