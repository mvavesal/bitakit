# Developer experience review

Date: 2026-10-02. Scope: Core, discovery, the React provider, the generated app, the CLI,
the ten optional packages and the two in-repo apps. Method: direct reading of Core and
discovery, generating and scaffolding a fresh app with the local tools, and three code
surveys (tooling and adapters, app wiring, plugin packages).

## Summary

The happy path is strong and the architecture underneath is sound. A generated app is a
one-line `next.config.ts`, a one-line provider, a catch-all route and a six-file sample
plugin. `bitakit add`, `info` and `doctor` all work on a fresh project, and the generated
AGENTS.md is the right artifact for AI collaboration. Service error messages are excellent.

The problems are not in the design. They are in the amount of surface, the number of
parallel ways to do the same thing, and one strategic gap.

1. **Plugins are client-side only.** Discovery skips `server` folders, the runtime is only
   created inside the React provider, and `apps/web` carries roughly 1,100 lines of
   hand-written server code for auth, organizations and settings. A SaaS feature is mostly
   server work, so today a plugin is half a feature.
2. **Too many ways to say one thing.** Eight ways to author an action, six spellings for
   service access, three interceptor helpers, three filename conventions, two reactivity
   models, two plugin-package models.
3. **Types stop short in a few places.** Action ID typos compile by default, class and
   factory actions are untyped, and events are the only contribution without generated types.
4. **Startup errors from Core are not all attributable.** A duplicate plugin ID or a cyclic
   dependency carries no plugin name, so development isolation blanks the whole app instead
   of turning off one plugin. The Turbopack fallback is a silent empty config.
5. **The showcase and the docs disagree with the generator.** `apps/web` uses legacy
   suffixes, explicit IDs and eight nested providers. Concepts are documented in three
   parallel sets plus a 123 KB German skill file that mixes durable rules with review logs.

Top three: add a server runtime with a typed client-to-server bridge, reduce each concept to
one documented way, and make services observable with a `useService` hook.

## Where the complexity comes from

Core exports 24 definition and factory functions. The `defineAction` input accepts about 35
properties. Most are unused:

| Property or helper | Usage outside Core |
| --- | --- |
| `dependsOn`, `unavailable`, `replaces`, `conventions`, `initialState` | tests only |
| `configPath` | nowhere |
| `state` on definitions | dropped at registration |
| `defineActionInterceptor`, `defineServiceInterceptor` | unused by apps and packages |
| curried `defineAction<Input>()` builder | changes the `execute` signature, unused in apps |

Parallel paths observed in the repo (the one to keep in bold):

- **Action authoring:** **`defineAction`**, `defineURLAction`, `defineFormAction`,
  `defineDialogAction`, curried builder, `class extends Action`, factory export,
  `useRegisterActions`. Class and factory exports take their ID from code instead of the
  path, so moving a file renames some actions and not others; 9 of 20 web actions have no
  generated type.
- **Service access:** `services.x`, **`app.services.x`**, `app.optional.services.x`,
  `getService(services, key)`, `useFoundation().runtime.services`, direct SDK singleton
  imports. The sample plugin uses three of them because the runtime mounts in an effect and
  the first render is not ready.
- **Service naming:** actions are namespaced per plugin, but public service names are global
  by bare filename. Two plugins with `services/store.ts` collide; the demo plugin hard-codes
  `demoPreferences` for this reason.
- **Reactivity:** `events` plus `onEvent` on actions, or observable services with
  `subscribe` plus `watch`. Pages hand-roll `useState` plus `useWatchEvent`. None of the ten
  packages use Core events; each built its own listener store.
- **Filenames:** `actions/x.ts`, `actions.x.ts` and `x.action.ts` are equivalent. The root
  AGENTS.md prescribes the suffix; the README and CLI use none.
- **Plugin packages:** hand-written `definePlugin` factories, or the convention model built
  by `bitakit build`. No first-party package uses the convention model, and it cannot express
  providers, contributions or installs. Only shell, app-preferences and quick-search work by
  `npm install` alone; the other six need host-constructed objects as constructor arguments,
  which the config channel cannot carry.
- **Naming:** BitaKit on the box, `Foundation` in every API, `@foundation/app`,
  `foundation.config.ts`, `foundation-generate`, and a generated header that still says
  "SaaS Foundation".

## What to change in Core

- **Add a server runtime and a bridge.** Discover `src/plugins/<id>/server/**` into a
  generated `.foundation/server.ts`, mounted once per process with `createServerRuntime()`.
  Add `defineServerService` with a generated client proxy over one route handler or server
  action, so a client service can call its server half with types. Let plugins contribute
  route handlers, webhooks and jobs the same way they contribute actions. This turns
  "plugin equals client feature" into "plugin equals full feature" and removes the
  hand-written server code in `apps/web` as a side effect.
- **One `defineAction` shape.** Fold `defineURLAction` into `defineAction({ href })`, which
  `ActionDefinition` already supports. Remove the curried builder and action state; state
  belongs in a service. Stop discovering bare class and factory exports in app plugins and
  keep the `Action` class as a library primitive. Move the test-only properties out or delete
  them before 1.0. Fix the generic footgun where `defineAction<string>` silently sets the
  result type to `void`.
- **Namespace services like actions.** Default the public name to `<plugin>.<file>`
  (`app.services.todos.tasks`), with `exposeAs` only for deliberate flattening. Fold
  `provideService(key, def)` into `defineService({ key, ... })`. Teach `requires` as an
  optional startup check, not a rule; the lazy service error already covers the miss.
- **Make services observable and add one hook.** Core already depends on zustand; expose a
  small `createStore` helper for service state and add `useService` and
  `useServiceValue(selector)` in `@bitakit/ui`. This replaces `watch`, most `onEvent`
  handlers and the `useState` plus `useWatchEvent` pattern with one line, and fixes the
  not-ready first render.
- **Generate `EventMap`.** A per-plugin `events.ts` with `defineEvents({...})` gives events
  the same typed treatment as actions and services; `doctor` can then flag an emit of an
  undeclared event.
- **One interceptor helper.** Keep `defineInterceptor` with a `kind` discriminator, delete
  the other two and the "legacy" branch before 0.2 ships. Order by `order` only; drop the
  filename list in `foundation.config.ts`.
- **Plugins receive host objects through services, not constructor arguments.** The Better
  Auth client, the SMTP transport and the settings storage should be host-provided services
  the package `requires`. Every package then has a zero-argument factory, becomes
  auto-discoverable, and the two plugin-package models collapse into one.
- **Attribute every startup error.** Throw `FoundationStartupError` with the plugin ID from
  runtime construction and ordering, not only from mount, and put the offending ID in each
  message. Allow startup isolation in production as an opt-in with logging.
- **Discovery hygiene.** Pick the folder convention and ship a codemod for suffixes. Warn
  about silently skipped files (no default export, `server` segment, `-` prefix). Stop
  reserving common folder names like `settings/` and `providers/` at the app root for
  integration kinds; put them under `contributions/`. Make the Turbopack stub throw in
  development, or at least warn.

## Plugins and tooling worth adding

- **Strict action IDs on by default** in generated apps, plus a dev warning when a bound ID
  is not registered.
- **`bitakit init`** for existing Next and TanStack apps; the generator refuses non-empty
  directories.
- **More `add` templates** for config, interceptor, view, setup, dialog and events, and a fix
  for nested paths (`notes/team/invite` currently truncates to `team.ts`).
- **A fuller `doctor`:** wiring checks for the config wrapper, provider and `--webpack`
  script, dependency cycles, duplicate pages and IDs, ignored files, locale namespaces, and
  `--json` for CI.
- **Generated route files for plugin pages** instead of a client catch-all, so pages get
  server rendering, metadata, a real 404 status and dynamic parameters.
- **Package-level auto-wiring for locales and CSS.** Discovery already knows the installed
  packages, yet both apps hand-import every package catalog and stylesheet, and the generated
  `styles.css` is unused.
- **A shared adapter kit** so the Next and TanStack packages stop being near-verbatim copies
  and a React Router or plain Vite adapter becomes cheap.
- **Testing:** a typed `mountPlugin` that reads the generated maps, a `renderWithFoundation`
  helper, and an event recorder.
- **Candidate plugins** that exercise the server runtime: billing with webhooks, feature
  flags, audit log, background jobs, and tenant-scoped storage with a policy hook.
- **Docs and AI guidance:** make the generated AGENTS.md the single source of conventions and
  build the docs-site conventions page from the same text. Move historical review logs out of
  the skill file into REVIEW.md, keep only durable rules, in English. Make `apps/web` follow
  its own conventions or replace it with the generated sample.

Package hygiene: `typescript` and `jiti` are runtime dependencies of Core and belong in a
discovery package; `@bitakit/ui` imports zustand without declaring it; `@bitakit/next`
claims React 18 support while `@bitakit/ui` requires 19.
