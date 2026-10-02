# @bitakit/cli

The `bitakit` command for BitaKit projects: add plugins and their files from templates, check a project for common problems, and build plugin packages. New in 0.2.

Apps created with `@bitakit/create-app` 0.2 already include it as a dev dependency. Elsewhere:

```sh
npm install --save-dev @bitakit/cli
```

Run it with `npx bitakit <command>` inside your app or plugin package.

## Add a feature

```sh
npx bitakit add plugin notes
```

This creates `src/plugins/notes/` with a service, actions, a navigation link and a page; discovery connects it, so there is nothing to register. `--minimal` creates only a service and one action.

Add single files to an existing plugin (inside a plugin package, give only the name):

```sh
npx bitakit add action notes/archive
npx bitakit add service notes/search
npx bitakit add page notes/archive
```

The file path decides the ID, for example `notes.archive`. Existing files are never overwritten.

## Check a project

```sh
npx bitakit doctor
```

Checks package versions, duplicate copies of `@bitakit/core`, plugin pages and links no route reaches, colliding service names and missing package styles, and prints a fix for each problem. It exits with an error code when it finds one.

`npx bitakit info` lists the plugins, actions, services and pages discovery finds in an app.

## Build a plugin package

Inside a package created with `npx @bitakit/create-app my-plugin --plugin`:

```sh
npx bitakit build          # types, compiled sources and dist/foundation.js
npx bitakit build --check  # type-check only
```

Apps that install the built package discover the plugin automatically.
