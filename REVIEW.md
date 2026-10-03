# Review

Open review requirements are added at the top of this file as dated sections. Durable rules
derived from reviews live in `.agents/skills/foundation-development/SKILL.md`; resolved
episodes are condensed into the history below.

## Implementation status: foundation integration (2026-10-03)

The later authorized implementation repaired the central loading path and the two runtime
defects. This status supersedes the original diagnosis below. Core remains headless; CSS
loading and validation live in Discovery/framework/build integration. No individual button
import or local theme override is required by the new sample or packed-app acceptance.

| Original item                   | Current status                               | Implemented change and evidence                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Cascade order                | Closed for verified Next integrations        | Shared `theme, base, components, utilities` prelude in root/generated CSS; browser CSSOM order, menu padding and button contrast verified in clean packed consumers in development and production.                                                                                                                                                                   |
| 2. Quick Search side-effect CSS | Closed                                       | Manifest stylesheet metadata replaces JavaScript CSS imports in all package entries. Generated CSS includes the package once. Quick Search's four tests pass.                                                                                                                                                                                                        |
| 3. Button-only workaround       | Closed                                       | Removed the individual HeroUI button import and explicit adapter CSS imports from Content Demo. Native geometry/contrast tests pass through the central styles.                                                                                                                                                                                                      |
| 4. Better Auth visual surfaces  | Closed for reported surfaces                 | Menus, account/password fields, separators and geometry pass. Fresh packed-app checks also verify two-factor dialog geometry/focus in light/dark at 390/1280px and persisted appearance. No real passwords or MFA settings are changed.                                                                                                                              |
| 5. Installed manifests          | Closed for affected adapters                 | Better Auth, Better Auth UI and next-intl export their manifests; adapter styles/theme are declared. Inaccessible opt-in manifests produce a package diagnostic. Packed auth integration passes installation, generation, types and Doctor.                                                                                                                          |
| 6. Demo browser routes          | Partial; suite remains red                   | Current account/organization routes replaced removed settings paths. Full Content Demo run: 9 passed, 4 failed; remaining cases are listed below rather than treated as passed.                                                                                                                                                                                      |
| 7. SettingsStore identity queue | Closed                                       | Completing or failing an old identity's save starts the new generation's queued drain. Seven settings tests pass, including both deferred old-save outcomes.                                                                                                                                                                                                         |
| 8. Service subscribe receiver   | Closed                                       | Generic React subscription calls preserve the service receiver. Eighteen foundation React tests pass, including a class service and cleanup.                                                                                                                                                                                                                         |
| 9. Fresh-app acceptance         | Closed for the scoped Next styling matrix    | Clean packed Next bare/sample/auth apps pass types, Doctor, production build and browser checks; auth additionally verifies development CSS updates, a valid lazy visual plugin, responsive native controls and appearance persistence. Experimental TanStack shapes were not rerun in this closeout; full-host action/page hot reload remains a separate open item. |
| 10. Doctor scope                | Closed for static wiring                     | Parses active root CSS imports and follows rendered local provider wrappers. Comments/unused imports do not satisfy wiring. CLI tests: 24 passed. Doctor does not claim visual verification.                                                                                                                                                                         |
| 11. Future plugin contract      | Partial, with an explicit guarantee boundary | CSS import graphs and explicit package-owned JS graphs are validated; invalid watched CSS fails the generated entry and recovers after correction. Next tests: 28 passed. Unsupported graph shapes are not comprehensively checked; see the open foundation work below.                                                                                              |

### Remaining foundation work

1. **[P1] Complete or explicitly reject unsupported plugin entry graphs.**
   `packages/discovery/src/styles.mjs` follows explicit JS exports and relative static or
   literal dynamic imports. Wildcard JS exports, nonliteral imports and external vendor JS
   graphs are not exhaustively traversed; CSS subpaths without a `.css` suffix can also
   evade the current script check. Explicit `bitakit.theme` entries are trusted theme
   authority, not isolated component CSS. Do not describe the current validator as a
   universal guarantee against all future plugin CSS. The next repair must validate these
   supported entry shapes or reject them with an actionable diagnostic, with installed
   fixtures for each shape. Arbitrary scripts outside the supported contract remain outside
   any CSS isolation guarantee.
2. **[P2] Recheck live action/page discovery in the full host.** The Content Demo test
   `e2e/discovery.spec.ts` failed to display a newly created `live-check.open` navigation
   action within its timeout. The authenticated shell rendered, and its configured group
   matches the fixture's `navigation` group. The cause is not yet established; do not
   dismiss this as an auth issue or equate the passing CSS watcher test with action/page
   hot-reload acceptance. Reproduce against an isolated fresh host, then verify add,
   title update and removal without a browser reload.
3. **[P2] Localize organization validation feedback.** The German organization form
   renders `Invalid URL.` from `packages/organizations/src/website.ts`, while its test
   expects German feedback. Validation rejects the value correctly; translation at the
   owning UI boundary remains open. Do not add another URL validator to repair wording.

### Deferred demo test maintenance

- The OAuth callback test expects a Google button, but explicit memory-preview configuration
  sets `socialProviders: []`. Give that isolated test the intended configuration; do not
  enable real OAuth merely to satisfy the fixture.
- The language test expects `Reset to default: Interface language`; the current generated
  control is `Reset Language to default`. Updating the locator and rerunning persistence/
  reset remains open. The language did change to English before this assertion failed.
- Organization validation translation and live discovery are tracked as foundation work
  above, not hidden inside a sample-only completion claim.

### Verification record

- Core settings: `node --test packages/core/tests/settings.test.mjs` — 7 passed.
- React bindings: `node --test packages/ui/tests/foundation-react.test.mjs` — 18 passed.
- `npm test --workspace @bitakit/next` — 28 passed; includes invalid order/reset/token,
  nested CSS/lazy JS imports, inaccessible manifest and watched invalidation/recovery.
- `npm test --workspace @bitakit/cli` — 24 passed.
- `npm test --workspace @bitakit/quick-search` — 4 passed.
- `npm test --workspace @bitakit/create-app` — 10 passed.
- `node scripts/verify-generated.mjs --only next-bare,next-sample --keep --skip-build` —
  both passed; retained evidence directory `bitakit-verify-lQ5UDG` in the system temp folder.
- `node scripts/verify-generated.mjs --only next-auth --keep --skip-build` — passed.
  Final expanded evidence: `bitakit-verify-WijBMB/next-auth/verification-development` and
  `verification-production` in the system temp folder. Includes live declared-plugin CSS
  updates, lazy plugin loading, native menus, account/password layout, two-factor dialog
  focus/geometry in light/dark at 390/1280px, and a Dark preference surviving reload.
  The test waits for settings hydration and cancels the native MFA dialog using Cancel.
  `--skip-build` packs previously built package output; it avoids disrupting the running
  preview and is not a claim of a new full workspace build.
- `npm run typecheck --workspace @bitakit/content-demo` — passed.
- `npm run test:e2e --workspace @bitakit/content-demo` — **9 passed, 4 failed**. Passed:
  native signup/invitation acceptance/resend/cancel/member/team flows, signout/signin/reset,
  account switching, light/dark native geometry, API-key lifecycle, responsive security
  cards, owned shell controls and both authentication-gated viewport tests. Mail is
  captured in the isolated test backend, never delivered externally.
- Todo sample typecheck and its two browser scripts passed: CRUD, native account/org
  switching, focus/session-refetch form preservation, settings, page/sidebar Clear,
  cancellation, scoped deletion and changed-context rejection. The local preview remains
  running at `http://127.0.0.1:3103`; credentials stay in ignored local files.

The entire monorepo test/lint/docs build chain and experimental TanStack generated cases
were not rerun for this closeout. There is no publish, merge or shared-database change.
The review is deliberately not marked entirely closed while the foundation gaps above remain.

## Initial findings: out-of-the-box app integration and styling (2026-10-03)

The following is the historical pre-implementation diagnosis. Its original status and
code references describe that snapshot; current completion is recorded above.

The refactor preview has a confirmed CSS cascade regression affecting native HeroUI
controls. Existing theme files are present; their presence does not guarantee that the
browser applies component styles in the intended order. This review records findings and
an ordered repair plan. It does not implement package or runtime changes.

**Required outcome:** A user creates a new BitaKit app, installs supported optional
packages and supplies their documented configuration. The app must inherit the shared
theme and correctly styled controls without copying CSS from Content Demo, importing
individual component styles, arranging undocumented imports, or manually activating
plugins that are intended to be discovered. Host-specific credentials and server auth
configuration remain explicit. Content Demo is one reproduction, not the acceptance
target for the whole fix.

**Implementation principle:** Fix the cause once in the responsible platform integration.
Baseline stylesheet loading, layer precedence and shared theme ownership must have one
central, automatic contract used by generated apps, existing apps and supported plugins.
Do not accept a fix that only makes Content Demo look correct, adds per-app/per-component
overrides, duplicates theme values, or requires consumers to repair import order manually.
Reuse the standard CSS and framework mechanisms already in use; do not introduce a custom
styling engine or a second registry. Platform ownership does not mean putting CSS in
headless Core: Discovery/build/framework integration owns loading, and the existing visual
packages own their component styles and theme mappings. Remove temporary workarounds as
part of the root fix. Completion requires the clean generated-app and future-plugin checks
below, not just a successful screenshot of the repaired demo.

### 1. [P1] Component styles lose to the base reset

- **Status:** Confirmed in the running Content Demo development preview.
- **Evidence:** The served CSS begins with Quick Search's `@layer components`, before the
  application's theme and base layers. CSS layer precedence follows first occurrence, so
  the later base layer wins over the earlier component layer. HeroUI's dropdown rules are
  present, and `--spacing` resolves to `.25rem`, but the dropdown menu and its item both
  have computed padding of `0px`. The earlier black-on-black button symptom is consistent
  with the same reset overriding component color and background declarations.
- **Sources:** `packages/quick-search/src/plugin.tsx:2` imports CSS as a JavaScript side
  effect; `src/index.ts` and `src/foundation.ts` do the same. The package's `styles.css`
  opens the components layer. `apps/content-demo/src/app/styles.css` declares the intended
  layer order, but that declaration does not precede the separately loaded package CSS
  in the observed browser output.
- **Repair location:** Package stylesheet integration and the root CSS entry. Register
  package styles through Discovery and establish the intended layer order before any
  package opens a layer. Do not solve this by adding padding, colors, or `!important` to
  individual menus.
- **Done when:** In both development and a production build, the first layer declarations
  establish `theme, base, components, utilities` in that order; native menu padding and
  button colors/backgrounds match the intended shared theme and adapter rules, including after direct
  page loads and client navigation.

### 2. [P1] Quick Search bypasses centralized stylesheet discovery

- **Status:** Confirmed integration gap contributing to item 1.
- **Evidence:** `packages/quick-search/package.json` exports its stylesheet and preserves
  JavaScript CSS side effects, but its plugin metadata does not declare `styles`.
  Consequently, the generated `apps/content-demo/src/bitakit.gen.css` does not include
  Quick Search. Other package styles are collected by
  `packages/discovery/src/packages.mjs`, with theme entries ordered last.
- **Repair location:** Quick Search's package metadata and public/plugin entries. Use the
  existing Discovery stylesheet mechanism; remove the competing JavaScript import path
  when the centralized path is connected. Audit other visual packages for the same gap.
  Never edit `bitakit.gen.css` by hand.
- **Done when:** The generated stylesheet includes Quick Search in dependency order,
  package CSS has one integration path, and loading a plugin cannot independently change
  the application's layer precedence.

### 3. [P2] The demo contains a temporary button-only workaround

- **Status:** Confirmed in the current uncommitted demo adjustments.
- **Evidence:** `apps/content-demo/src/app/styles.css` directly imports
  `@heroui/styles/components/button.css` in addition to the adapter's full HeroUI style
  import. Its unlayered component rules restored button contrast, while layered menu
  styles remain affected. This masks one symptom without repairing the loading contract.
- **Repair location:** Remove the extra component import after items 1 and 2 are fixed.
  Keep upstream HeroUI structure and the existing central theme bridge, rather than
  introducing a list of per-component imports or custom replacements.
- **Done when:** Buttons remain readable without the workaround; menus, inputs and
  dialogs also receive the intended styles through the same integration.

### 4. [P2] Better Auth settings surfaces need a complete visual regression pass

- **Status:** User-reported; individual causes are not yet confirmed.
- **Reported surfaces:** User and organization menus, two-factor settings layout,
  change-password forms and text inputs. Do not claim that every reported difference
  comes from item 1 until each surface has been checked after the cascade repair.
- **Existing ownership:** Shared geometry and colors remain in `packages/ui/theme.css`;
  HeroUI token mappings and visual adaptations remain in
  `packages/better-auth-ui/theme.css`. Upstream components come from the existing Better
  Auth UI integration. Package presence and passing TypeScript checks are insufficient
  evidence of correct rendering.
- **Repair location:** First fix stylesheet loading. Then correct any remaining confirmed
  mapping or component integration defect in its owning visual package. Keep Core
  independent of CSS, React and visual libraries; do not recreate auth controls in the app.
- **Done when:** Check light/dark modes, narrow/wide viewports, focus, open menus and
  dialogs, input spacing and button contrast in development and production. Record
  browser screenshots and meaningful computed-style assertions. Preserve upstream auth
  behavior; visual verification must not change real passwords, enable two-factor auth,
  or send invitations.

### 5. [P1] Installed adapter packages can be silently skipped by Discovery

- **Status:** Confirmed from package exports and Discovery's resolution path.
- **Evidence:** `packages/discovery/src/packages.mjs` resolves `<package>/package.json`
  and silently skips `ERR_PACKAGE_PATH_NOT_EXPORTED`. The Better Auth, Better Auth UI
  and next-intl manifests declare plugin metadata but do not export `./package.json`.
  The demo currently compensates with explicit `additionalPlugins` and explicit auth
  styles. This bypass explains why installing a package is not sufficient for automatic
  activation and stylesheet collection in this preview.
- **Repair location:** The optional adapters' public manifest exports and Discovery's
  diagnostics. Better Auth UI also needs stylesheet/theme metadata; exporting its
  manifest alone will not collect CSS that is not declared there. Preserve the supported
  explicit host auth configuration rather than blindly deleting all composition code.
- **Done when:** Verify discovery against packed/installed packages, not only source
  directories. Expected plugins, catalogs and styles are collected. Package-contract tests
  catch inaccessible opt-in manifests, and diagnostics identify skipped known BitaKit
  packages without flagging ordinary dependencies as broken plugins. Review temporary wiring
  only after this works.

### 6. [P2] Demo browser tests still target removed settings routes

- **Status:** Confirmed stale test targets; the full suite has not been rerun for this preview.
- **Evidence:** `apps/content-demo/e2e/better-auth-ui.spec.ts` still visits
  `/settings/security` and `/settings/organization-members`; current plugin pages use
  `/settings/account` and `/settings/organization` with URL-backed tabs. Existing visual
  assertions should be preserved and adapted, not discarded to get a passing result.
- **Repair location:** Demo browser tests and, where required by an explicit compatibility
  decision, native host redirects. Do not restore the removed settings catalog.
- **Done when:** Tests exercise current pages, user/organization menus, pending invitations,
  two-factor and password-form rendering. Test real isolated auth separately from the
  memory preview; successful memory login does not prove email or external OAuth works.

### 7. [P1] Settings writes can stall across an identity change

- **Status:** Code-path defect identified in the architecture review; unrelated to CSS.
- **Evidence:** In `packages/core/src/settings/store.ts`, activation changes the generation
  and cancels queued work but leaves an in-flight slot marked `flying`. A write queued for
  the newly loaded identity does not start a drain while that flag is true. When the old
  save completes, its drain exits on the generation mismatch and clears `flying` without
  starting the new queued write. That write can remain pending indefinitely.
- **Repair location:** SettingsStore's generation/queue lifecycle. This is a proposed Core
  fix, not authorization to modify Core during the demo work.
- **Done when:** A deterministic deferred-storage test starts a save for identity A,
  activates identity B, queues B's save, then completes A's save. B's save must finish and
  pending must clear; A's result must not overwrite B's state or storage context.

### 8. [P2] Service subscriptions can lose the service method receiver

- **Status:** Confirmed from the React binding implementation; unrelated to CSS.
- **Evidence:** `packages/ui/src/hooks/use-service.ts:45` copies `candidate.subscribe`
  into a new source object, then invokes `source.subscribe(listener)`. A class service
  whose method uses `this` receives the wrapper object rather than the service instance.
  Arrow-function subscriptions and the `state: store()` path can hide this problem.
- **Repair location:** The generic service-state binding. Preserve the original receiver
  when invoking a supported service's `subscribe`; do not add per-service app wrappers.
- **Done when:** A hook test with a class-based service verifies subscription, updates and
  cleanup, alongside the existing store and arrow-function service cases.

### 9. [P1] New-app acceptance does not currently cover the styling failure

- **Status:** Confirmed verification gap; a fresh generated app was not run during this
  review, so the exact demo failure is not yet claimed for every generated configuration.
- **Evidence:** `packages/create-app/src/project-files.mjs` emits a Tailwind import and
  `bitakit.gen.css`. The Next adapter imports the generated provider before global CSS.
  This root composition must be checked together with package CSS side effects; merely
  inserting a layer declaration into a later file cannot undo an already established order.
  `scripts/verify-generated.mjs` already installs packed packages, checks types and doctor,
  builds production apps, and runs browser smoke checks. Those checks cover expected text,
  basic sample actions and console errors, but do not assert menu/input styling, layer
  precedence, development-mode behavior or optional Better Auth UI integration.
- **Repair location:** Shared create-app stylesheet/layout templates, installed-package
  integration, and the existing generated-app verification script. Extend that workflow;
  do not build a parallel generator or rely only on the monorepo demo.
- **Done when:** Generate a clean Next app outside workspace resolution using packed
  release candidates. Check bare, Shell/settings/Quick Search, and an explicitly configured
  optional Better Auth UI composition. Check first load, direct settings navigation,
  client navigation and development reload, plus the production build. Confirm central
  theme inheritance, readable controls, menu/dialog/input layout, and persistent appearance
  preferences in light/dark modes and narrow/wide viewports. No demo CSS or per-component
  workaround may be copied into the generated app. Keep the existing experimental
  TanStack verification separate; do not imply equal support without verifying it.

### 10. [P2] Doctor's stylesheet check can report success without a valid cascade

- **Status:** Confirmed limitation of `packages/cli/src/doctor.mjs:checkStyles`.
- **Evidence:** The check accepts a source-file string containing `bitakit.gen.css`, or
  individual imports for the styles Discovery found. It does not inspect served layer
  order, confirm imports are active, or detect styles belonging to skipped packages.
  Its candidate filenames also omit Content Demo's `src/app/styles.css`.
- **Repair location:** Doctor's static diagnostics and the browser verification workflow.
  Resolve the actual framework stylesheet entry where practical, report the scope of the
  check accurately, and use browser checks to establish computed visual correctness.
- **Done when:** A skipped known plugin or broken stylesheet entry cannot be described as
  fully validated styling. Valid alternative root filenames are recognized. Tests cover
  missing/inactive imports; rendered cascade assertions remain in browser verification.

### 11. [P1] Future plugins need an enforced CSS loading contract

- **Status:** Required architecture safeguard exposed by the confirmed Quick Search
  incident; not an implemented guarantee.
- **Problem:** Documentation, correct imports in today's packages and a passing demo do
  not prevent a new plugin from opening a layer before the host, importing another reset,
  or shipping global overrides. The platform must own baseline ordering rather than
  relying on every plugin author to remember an import sequence.
- **Required invariant:** The application establishes `theme, base, components, utilities`
  before any plugin CSS can be applied, including CSS reached through
  eager JavaScript imports, lazy chunks, direct route loads and development updates.
  Central resets and theme tokens have explicit owners; ordinary plugin styles cannot
  redefine that ownership.
- **Repair location:** Discovery/build CSS integration, framework root templates, plugin
  scaffolds and package validation. Choose a deterministic framework-supported bootstrap
  for the layer prelude that precedes all stylesheets; do not depend on incidental
  JavaScript traversal order. Plugin manifests declare component styles and intentional
  theme contributions separately. Validate the emitted CSS/import graph as well as
  metadata, and reject unsupported baseline resets, order declarations or global theme
  overrides with an actionable package/file diagnostic. Audit legitimate upstream CSS
  imports so validation does not reject supported adapters or require vendoring them.
- **Done when:** Add a fixture plugin that attempts to register `components` early, one
  that imports an extra reset, and one that changes shared tokens outside the theme
  contract. The integration must either normalize the supported input into the declared
  contract or fail explicitly before delivering a broken app. Also test a valid plugin
  loaded lazily: the baseline order and existing controls must remain unchanged. Run
  these checks against generated apps in development and production; verify installed
  package output, not just template text.
- **Guarantee boundary:** Guarantee deterministic baseline loading for plugins accepted
  through the supported integration. Arbitrary CSS or scripts injected outside that
  contract can still affect the same document. Do not promise complete isolation from
  unrestricted third-party code; stronger isolation would be a separate design decision.

### Organization access: expected gating, not a confirmed missing UI

`packages/better-auth-ui/src/settings/organizations.tsx` still provides Profile,
Members and invitations, and Invitations for me. The management tab requires
`canManage`, which depends on an active organization and the viewer's access. The
temporary preview account has no active organization, so the management tab is hidden.
After the menu styling repair, verify organization creation/selection and access to
members and pending invitations with disposable local data. Do not bypass role checks
to make a tab visible. Local preview email delivery is not configured.

### Repair order and scope

1. Fix manifest accessibility and stylesheet metadata for the affected packages.
2. Establish one stylesheet integration path and correct initial layer ordering in the
   generator as well as existing apps; enforce the future-plugin contract and verify the
   shared theme bridge.
3. Remove the demo's button workaround and update its stale browser-test routes.
4. Verify reported Better Auth surfaces and organization selection, members and pending
   invitations with local test data; record remaining defects separately.
5. Extend packed/generated-app verification for the cascade and rendered controls in
   development and production, and correct the scope of Doctor's diagnostics.
6. Address the separate SettingsStore and service-subscription defects with targeted tests.

Items 1 and 2 describe the same cascade incident and its package integration cause; they
are linked work, not two independently reproduced visual regressions. Item 4 contains
unverified reports. Items 9 and 10 are acceptance/diagnostic gaps, not claims that a new
app or the full generated-app suite was executed during this review.

The original request was diagnosis before implementation. Core/library changes were
subsequently authorized and are recorded in the implementation status above. No styling
approach can promise that regressions will never occur; a single loading contract and
browser checks make recurrence detectable.

## History (pre-0.2)

One line per resolved review item or confirmed regression. Behavior described here is
history; the current contract is `docs/target-api.md` and the skill.

### Actions, groups and forms (review 2026-10-02)

- Quick Search stays navigation-only: it lists visible URL actions and never runs non-URL actions; `results.actions` was removed and `runtime.ownerOf()` is private again.
- Forms do not require a dialog: a page form runs an ordinary action through `useAction`, a dialog is an optional host; `defineFormAction` stayed documented as the quick dialog form until 0.2 removed form actions from Core.
- Action groups are explained independently of UI: a group only groups; components (menu, navigation, search) decide presentation; the "Action groups" docs page is the reference.
- A group's title belongs to its ID: the runtime keeps the first title given regardless of registration order; `useGroupTitle` falls back to it.
- The Actions guide opens with one default path and keeps `description`/`tooltip`, `enabled`/`visible`/`pending` distinct; the complexity audit found `dependsOn`, `unavailable`, `replaces`, `conventions`, `initialState` used only in tests and `configPath` unused, which led to their removal in 0.2.
- Hover text in every binding resolves `title` prop, then `tooltip`, then `description`; a button resolves its snapshot with its own input.

### Discovery and lifecycle

- A discovered second action stayed invisible because a demo menu rendered three fixed IDs and the copy used another group and path: discovery, placement and routing are separate stages to check.
- Recursive discovery must watch directory creation and renames; an extension filter alone missed the first action in a new folder.
- Explicit host routes win over the plugin catch-all in Next; duplicate or invalid plugin paths are rejected before mount; a client fallback is not an HTTP 404.
- Hot reload recreates local demo services and resets their data; never present that as persistence.
- Turbopack resolved the generated absolute `.foundation/app.ts` alias as a server-relative import, which forced `--webpack` until 0.2 replaced the alias with real generated files.
- `additionalPlugins` replaced discovered plugins out of order once (settings.ui before shell.ui); entries now replace in place and only new IDs append.
- `foundation.plugin` package factories received the resolved root config path (`foundation.configuration`); Shell and App Preferences activated automatically while remaining direct dependencies.
- Service names: public names were global by bare filename, so two plugins with `services/store.ts` collided; 0.2 namespaces services as `<plugin>.<file>`.

### Settings and App Preferences

- `AppPreferences` is the single owner of confirmed values; sections only reference definitions; removing a section never deletes stored values.
- Renderer precedence (app field > owner plugin field > type+variant layers > built-in) is resolved by one service; unknown variants are configuration errors; owner and layer come from the runtime scope, never from caller strings.
- The initial render snapshot must match the mounted runtime (SSR, hydration, mount); `SettingsProvider` keeps the initial catalog snapshot only for hydration.
- Settings navigation and overview must include field-based sections, not only legacy groups; shared category parents are registered once and never removed by a plugin's cleanup.
- Nested mobile settings drawer: the dialog ignores Escape from the portaled drawer; wait for real focus in browser checks.
- `SettingSelect` did not forward `error` to its `as` component (gap recorded; fixed centrally later).
- `data-disabled={disabled}` serialized `false` and disabled hover on every option card: boolean `data-*` flags are `value || undefined`.
- Reicon Outline mixes pre-expanded fill paths and true stroke paths; do not pair icons from both families; the layout choice used Sidebar and Window2.
- Individual reset is owned by App Preferences (`resetControl`); Shell only places the bound part.

### Shell, navigation and notifications

- Shell owns appearance and layout preferences, standalone NotFound/Error/Loading/AccessDenied pages and the shared HeroUI notification queue exposed as `app.services.notifications`; the position preference uses native placements.
- Package stylesheets that import `@heroui/styles` restore the theme's dark custom variant right after the import; HeroUI's variant painted shadcn hit areas as squares in generated apps.
- Horizontal shell renders bound groups as NavigationMenu categories; user trigger is an avatar; settings search sits in the sidebar; no second app header.
- Sidebar identity triggers map HeroUI hover/pressed colors to sidebar tokens; the content header uses background tokens so an independent dark sidebar does not darken it.
- Quick Search imports its CSS from the plugin module; `sideEffects` metadata keeps it from being pruned.
- Translation: `useTranslation` observes runtime notification revisions, not translator identity; settings and navigation resolve `settings.sections.<id>` and `settings.categories.<id>` keys; action labels use the shared `<id>.title` path everywhere.

### Better Auth, Better Auth UI and organizations

- Better Auth UI is consumed unmodified from npm; the vendored shadcn experiment was discarded; upstream re-exports live flat under `src/upstream`.
- Theme bridge: destructive HeroUI buttons join the primary surface mapping; card dividers map to the solid border; small buttons use Vega sm; tooltip triggers keep button flex layout; menu leading icons normalize to size-4.
- With separate UI and auth origins, Better Auth UI redirect targets must be absolute UI-origin URLs; same-origin memory tests do not catch this.
- Google and GitHub login activate only with their env secrets; a visible button proves no provider configuration.
- `multipleAccountsPerProvider: false` hides a second Google link row; it is UI only.
- Account settings (`/settings/profile`, `/settings/security`) are composed from public components; HeroUI `Settings` ignored `hideNav`, so embedded content uses the domain components instead of CSS hiding.
- Organizations: headless contract and service in `organizations`, UI in `better-auth-ui`; row actions render through public groups in a shared dropdown; tables stay one shadcn table with container scrolling; invitation dialogs re-check the opening context.
- Adapter details: `getOrganization` instead of `getFullOrganization` for identity; dates normalized to ISO strings at the package boundary; session objects compared by identity fields, not object identity; capability checks at render time; website validation shared between form and server with tldts; role changes name the fixed target and confirm.
- Two-factor uses Better Auth `twoFactor` and the UI plugin unchanged; migrations protect the table with RLS; API keys are shown once and revoked after tests.
- Local Supabase: the session pooler answered parallel queries where direct connections hung; TLS and CA verification stay on.
- Mail: `npm run dev:content-auth` loads the ignored mail env; Ethereal intercepts messages; SMTP verify proves no delivery.

### Generator, adapters and docs

- `create-app` uses the official pinned `create-next-app` empty scaffold and the blank TanStack Start template, never overwrites, keeps partial output on failure and supports `--no-install`, `--dry-run`, `--sample`, `--plugin` and `--packages-dir`.
- TanStack Start stays experimental: nuqs excludes it from supported coverage; verified versions are recorded in the package README.
- Generated type imports omit unused contribution types so strict host `noUnusedLocals` stays on.
- The docs site (`apps/docs`, Fumadocs) targets application developers; contributor steps stay in the contributing guide; README diagrams are generated by `scripts/readme-diagrams.mjs`.
- Core 0.1.1 and thirteen packages at 0.1.0 were published on 2026-10-01 after archive, export and license checks; the npm organization `bitakit` was verified.
