---
name: bitakit-app-development
description: Add or change a feature in an existing BitaKit application. Use when inspecting an app, choosing its feature owner or layout extension point, scaffolding a plugin, or checking the rendered result.
---

# BitaKit app development

Use the application's installed source, generated types and package versions as evidence. Keep a
feature in its owning plugin and use BitaKit's existing contracts and tooling. This guide is for
consumer applications; BitaKit package development follows the repository's separate contributor
guidance.

## Create a new application

When the request is for a new app, first establish the requested framework and visual composition.
Use `npx @bitakit/create-app <directory> --framework <next|tanstack> --yes` with the requested
feature selections; add `--sample` when a working reference is useful. The sample is two plugins
(`todos` and `activity`) that demonstrate an event and a real slot contribution. Do not add Shell
or a sidebar by default when the requested app shape does not call for them.

After scaffolding, work from the new app directory. Read its generated `AGENTS.md` and this skill,
confirm the installed package versions and framework root/provider composition, then follow the
inspection and implementation steps below. `bitakit init` delivers the same guidance to a
supported existing app. For local monorepo acceptance, use the repository's existing packed
consumer flow when available; do not silently substitute published packages for changed local
packages.

## Inspect the application

1. Read the nearest `AGENTS.md` and the project's package manifest. Identify the framework,
   package manager, scripts, installed `@bitakit/*` versions and existing feature folders. Check
   the lockfile or package-manager output when the manifest alone cannot establish installed
   versions. If BitaKit packages are on different versions, report that and use the installed
   declarations and documentation; do not assume APIs from another release.
2. Run `npx bitakit info --json` and `npx bitakit doctor --json`. Use the versioned `static`
   inventory for declarations it resolves and `live` only when it is available. Installed package
   entries may have `declarations: null`, and the CLI does not report every Action placement;
   inspect installed package metadata and source when those facts matter. `null`, unresolved
   declarations and absent package metadata mean unknown; do not turn them into guessed facts.
   Doctor's JSON results include status and suggested fixes. Resolve relevant existing setup
   errors before attributing a failure to the feature being changed.
3. Read the installed package README, generated `src/bitakit.gen.*` types and the owning source
   files that define the relevant services, Actions, settings, events and slots. Generated files
   are evidence for types, never edit targets. Use guidance and framework APIs that match the
   versions installed in this app.

## Choose the feature owner and visual destination

Keep native framework composition separate from BitaKit's visual shell. A Next.js or TanStack
root layout wires the provider and framework routes. `@bitakit/shell`'s `AppShell`, a named
`src/layouts/<name>.tsx`, or an app-owned layout controls the visual frame. Do not infer one from
the other.

Before placing UI, inspect the app's selected composition and the layout owner's actual outlet:

- Read the layout implementation and its package guidance. Find the `useSlot`, `PluginSlot`,
  `useNavigation` or other renderer that consumes the intended contract.
- Check the declared contract in generated `SlotMap` and owner source; use `bitakit info --json`
  when it resolves the declaration. Installed package inventories can be unknown, and the CLI
  does not report every Action placement. A declaration or type alone does not prove an outlet is
  mounted or visible in the selected layout. Verify that the renderer actually uses that slot.
- Match the contribution to the contract: an Action slot accepts Actions; a component slot accepts
  a UI component. Groups are logical queries and do not place controls.
- With Shell, `shell.navigation` and `shell.toolbar` are Action destinations. `app-bar.end` is a
  component outlet in both sidebar and navbar layouts. `sidebar.header`, `sidebar.body` and
  `sidebar.footer` are sidebar-only; they are not rendered by the navbar layout. Check the
  installed Shell README for current contracts and behavior.
- If no compatible outlet exists, keep the feature local or identify the layout owner that must
  add one. Do not invent a slot name, silently change a shared layout, or promise that every
  layout can show the contribution. A new extension point belongs to the layout owner; the
  feature plugin contributes through its declared contract.

## Implement in the owning plugin

Use `npx bitakit add plugin <name>` for a new feature, then add only the files it needs. Use
`npx bitakit add <kind> <plugin>/<name>` for supported contributions to an existing plugin.
For example, `npx bitakit add slot <plugin>/<slot>` creates a component contribution; it does not
declare a new slot contract. Add Actions, services, settings, events and slot declarations in
the plugin that owns those behaviors. Extend another feature through its public service, event or
slot contract rather than editing its folder when the contract is sufficient.

Keep state in the owning service store, preferences in `defineSettings`, and host configuration
in `defineConfig`/host overrides. Bind controls that run operations to the existing Action
bindings (`Action`, `ActionButton` or `ActionLink`); do not duplicate pending, disabled,
confirmation or navigation behavior in local handlers. Use the app's central UI components and
theme tokens.

## Check and inspect the result

1. Run `npx bitakit generate` when the framework or check flow has not regenerated discovery.
   Then run the app's focused typecheck and `npx bitakit doctor --json`. Read each result's
   status, evidence and fix; do not claim checks that were not run.
2. Test the changed behavior with the app's existing runner and scoped inputs/expected outcomes.
   Use `@bitakit/core/testing`'s `mountPlugin` for headless lifecycle, service, Action and event
   behavior. Use `@bitakit/ui/testing`'s `renderWithBitaKit` when behavior depends on React and a
   test-owned DOM. A generic mount or startup check does not prove product behavior. Do not
   execute every real app Action in a test runtime.
3. Start the existing development app and inspect the actual selected page and outlet in its
   browser. Exercise the contribution in the layout where it is meant to appear. For layout
   changes, verify every promised layout separately; a sidebar-only result does not establish
   navbar visibility. A declaration, generated type or passing unit test is not rendered evidence.
4. Summarize files changed, checks actually run and the rendered behavior observed. Keep
   unverified states explicit and retain unknown inventory fields as unknown.

## Keep the host simple

Discovery owns generated registration. Do not hand-edit `src/bitakit.gen.*`, add a second plugin
or settings registry, or create a separate runtime, test engine or layout system. Preserve the
framework's native routing and existing provider composition. Plugin folders clarify ownership;
they are not a sandbox or a guarantee of isolated execution.
