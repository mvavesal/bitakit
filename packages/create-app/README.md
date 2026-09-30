# @bitakit/create-app

A small frontend project generator. Supports **Next.js** and **experimental TanStack Start (React)**. It runs the
pinned official framework CLI with an empty/blank template and adds Foundation dependencies,
native routes and essential configuration. It does not copy plugin implementations,
create a backend, install auth/database services or add demo business pages.

## Local usage

From this repository after `npm install`:

```sh
node packages/create-app/src/cli.mjs my-app
node packages/create-app/src/cli.mjs my-app --framework next --features shell,quick-search --no-install --yes
node packages/create-app/src/cli.mjs my-app --features none --dry-run --yes
```

The interactive flow asks for the directory, framework (Next.js or experimental TanStack Start), then
optional capabilities. Equivalent flags support non-interactive use. No features are
selected by default. Shell requires App Preferences; Quick Search requires Shell.
Selecting prerequisites is automatic, and the resolved selection is printed before writing.
App Preferences alone installs the existing runtime capability without inventing example settings.

The destination must not exist. Existing projects, including empty directories and
symlinks, are never overwritten. Cancel prompts before scaffolding to leave no output.
After a process/install failure, generated files remain for inspection; the CLI exits
with an error and does not print a completion message.

## Verify before publication

The generator is private until release preparation is complete. Foundation packages
are not assumed to exist on the public registry. To install generated projects now,
build the selected packages and `npm pack` them into a dedicated directory. Include
Core, UI, the selected host adapter and all Foundation dependencies of your chosen features. Then run:

```sh
node packages/create-app/src/cli.mjs my-app --features shell,quick-search --packages-dir /absolute/path/to/tarballs --yes
```

Use standard npm-generated filenames, one version per package. This mode writes local
file dependencies and npm overrides so transitive Foundation packages also resolve to
tarballs. Those paths are local verification configuration, not portable release metadata.
Normal generation uses versioned registry dependencies. No custom package registry is built.

After a future public release, the intended command is:

```sh
npx @bitakit/create-app my-app --framework next --features shell,quick-search
```

This is a proposed published entry point, not a claim that the package is already available.
Keep `private: true` until npm scope ownership, licensing, version compatibility and package
publication order have been reviewed. No publish command runs in this tool.

## Output

The minimal preset has native framework configuration, root layout, one welcome page and
shared CSS imports. Foundation mounts directly in the root layout; there is no host
provider wrapper, manual plugin registry, empty contribution folders or copied theme.
Selected Shell adds its config and native settings/workspace route layouts. Settings
search uses nuqs through the selected host adapter. Settings values remain in App Preferences.

The Next scaffold deliberately uses Webpack through the existing Next adapter because
this repository has an unresolved Turbopack generated-alias issue. No runtime code or
alternative discovery implementation is added to Core. Language setup and authentication
are not options in this first generator version.

## Source responsibilities

- `src/cli.mjs`: Commander arguments and Clack prompts/cancellation.
- `src/create-app.mjs`: destination checks, ordered generation/install and local tarball setup.
- `src/features.mjs`: capability prerequisites; not a runtime plugin registry.
- `src/project-files.mjs`: shared package manifest, README and stylesheet composition.
- `src/adapters/next.mjs`: official framework invocation and Next-specific configuration.
- `src/adapters/tanstack.mjs`: official blank Start scaffold and Vite/native-route configuration.
- `templates/next` and `templates/tanstack`: small native app-owned routes, not copies of plugins.
- `tests/create-app.test.mjs`: output boundaries, prerequisites, refusal to overwrite and failures.

TanStack Start is explicitly experimental: the nuqs Router adapter is reused unchanged,
but its upstream docs still exclude Start from supported coverage. Our settings/query
smoke checks pass; this is not a claim of full Start compatibility. The selected integration
package owns navigation and its nuqs provider. The generator installs only that adapter.

```sh
node packages/create-app/src/cli.mjs my-start-app --framework tanstack --features shell,quick-search --packages-dir /absolute/path/to/tarballs --yes
```

Run `npm test --workspace @bitakit/create-app`. Release verification additionally
requires packing the CLI and its Foundation dependencies, generating outside this repository,
installing, typechecking, building and exercising the generated application.

## Verification recorded for this version

Six focused CLI tests passed. Both the minimal preset and the Shell/Quick Search preset
were generated into a temporary directory outside this repository, installed from actual
npm tarballs, typechecked and production-built successfully. Browser checks covered the
welcome/settings routes, Quick Search dialog, settings query-string updates and mobile
layout without overflow or page errors. The packed CLI also generated a minimal project
through npm exec. No public registry publication was performed.

September 30 adapter verification: seven focused generator tests, ordered shared-provider
composition and five discovery-host checks passed (including strict empty-output compilation). Isolated packed Next and Start apps
with Shell/Quick Search passed typecheck/build. Browser checks verified settings query
updates/reload on both and native route/back restoration on Start. Next owns its NuqsAdapter;
no generated host Nuqs wrapper remains. Start support remains experimental.
