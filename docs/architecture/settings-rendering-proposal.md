# App Preferences architecture and rendering proposal

Status: consolidated design for review. All APIs below are illustrative, not implemented exports. This document authorizes no runtime changes. Reuse Foundation's existing plugins, typed services, registration ownership and cleanup rather than duplicating infrastructure in Settings.

## 1. Responsibilities and boundaries

- **Preference definitions:** stable namespaced field keys, value types, defaults, scope and established schema validation. Plain presentation hints such as order, variant and columns are allowed. Keep data definitions separate from React rendering for clarity; shared server usage is not required.
- **AppPreferences:** owns confirmed values, validation coordination, pending/error state, subscriptions and persistence coordination. Transport/storage is replaceable. Expose the same instance through the existing typed Core service mechanism when integrated with Foundation.
- **Catalog:** owns section placement and metadata; sections reference collections. Data registration does not depend on section existence or mounted views. Moving a field does not change its storage key.
- **Rendering service:** Settings' React integration supplies one application-scoped service for field, type, section and whole-view rendering. Core manages the service lifecycle but knows nothing about React or renderer semantics.
- **Remote storage adapter:** calls an independently owned backend API when persistence is remote. The API verifies identity, access and input itself; client validation is not authorization.

Sections may include React icons and therefore belong to the UI import graph. They are not backend persistence contracts. No additional icon registry is required. Client UI modules may participate in framework SSR; browser-only effects remain separate.

## 2. Default developer workflow

```text
src/
  configs/                  # Runtime/deployment configuration
  settings/
    editor.ts               # Preference definitions only
  sections/
    editor.tsx              # Settings sections, possibly React icons
  renderers/
    editor.tsx              # Optional declarative renderer descriptors
  components/settings/
    number-picker.tsx       # Helper component; not discovered
  setup.ts                  # Optional imperative customization
```

Use the same convention inside a plugin source root. The configured folder identifies the contribution kind; filenames do not repeat it. All folders are optional. Explicit directory overrides must be supported to avoid collisions with existing application folders. Existing mixed-use settings directories must be migrated or excluded before discovery uses them as definition roots. Sections/renderers are Settings contribution roots here, not reserved names for all applications.

```ts
// src/settings/editor.ts — preference definitions
export const editorSettings = defineSettings({
  id: 'editor',
  scope: 'user',
  fields: {
    autosave: booleanField({
      title: { key: 'editor.autosave.title', fallback: 'Auto save' },
      defaultValue: true,
      presentation: { order: 10 },
    }),
    pageSize: numberField({
      defaultValue: 20,
      schema: z.number().int().min(5).max(100),
      presentation: { order: 20 },
    }),
    density: choiceField({
      options: ['comfortable', 'compact'],
      defaultValue: 'comfortable',
      presentation: { order: 30, variant: 'cards', columns: 2 },
    }),
  },
});
export default editorSettings;
```

```tsx
// src/sections/editor.tsx — UI contribution
export default defineSettingsSection({
  id: 'editor',
  title: { key: 'editor.title', fallback: 'Editor' },
  settings: [editorSettings], // Multiple collections are supported.
});

// src/renderers/editor.tsx — no manual service registration required
export default defineSettingsRenderers({
  fields: [
    fieldRenderer(editorSettings.fields.pageSize, ({
      value, setValue, disabled, pending, error,
    }) => (
      <NumberPicker value={value} onCommit={setValue}
        disabled={disabled || pending} error={error} />
    )),
  ],
  sections: [
    sectionRenderer('editor', ({ title, items }) => (
      <MySection title={title}>
        {items.map(item => (
          <MyRow key={item.key} label={item.label}
            description={item.description} control={item.control}
            feedback={item.feedback} />
        ))}
      </MySection>
    )),
  ],
});
```

Fields appear automatically without a repeated content list. Sort by order, then collection order, then declaration order. Custom controls receive state typed from their field reference and do not implement separate storage or subscriptions. Section items also expose complete `content` for simple layouts. Preserve label/control/error associations when exposing separate slots.

Titles support literal strings and explicit localization descriptors resolved through the existing i18n integration. A conventional default key can be offered without forcing a second translation system.

## 3. Renderer service and Core integration

The Settings UI plugin provides a shared typed service key and the service implementation. Declarative contributions are the normal path; direct service access remains available for dynamic customization.

```tsx
// Settings UI integration — conceptual provider
export const settingsRendererService =
  serviceKey<SettingsRendererService>('settings.renderer');

provideService(settingsRendererService, {
  create: () => new SettingsRendererService({
    defaults: standardSettingsRenderers,
  }),
});

// Optional imperative setup — uses the SAME service
export default defineSetup(({ app, services }) => {
  const renderers = getService(services, settingsRendererService);
  const registration = renderers.registerType('boolean', {
    layer: 'app',
    component: MyCheckbox,
  });
  app.own(() => registration.remove());
});

// Normal application usage
<SettingsView />;
```

The example illustrates service access, not an SSR initialization solution. Ownership is inferred from the calling module's lifecycle context, not a caller-supplied owner string. Declarative layer is also inferred. Any imperative layer option must be constrained by the caller's scope; it cannot let plugins impersonate app overrides.

Use distinct typed operations for registration and rendering: for example registerField/registerType/registerSection/registerView versus renderField/renderSection/renderSettings. Whole-view defaults can later expose independently replaceable navigation and content components sharing the same selection state. Do not introduce another authoritative store.

## 4. Deterministic renderer resolution

```text
App field override
  > Field owner's plugin-specific field renderer
  > App type + requested variant
  > Field owner's plugin type + requested variant
  > Built-in requested variant
  > App generic type
  > Field owner's plugin generic type
  > Built-in type default
```

Variant stages apply when a field requests a variant. A generic choice override does not erase an explicit cards request. An unknown variant without a matching registered implementation is a configuration error, not a silent fallback. A field-specific renderer explicitly replaces that field's presentation.

Plugin type renderers apply only to their own plugin's fields. App overrides may be global. Replacing a plugin-specific field renderer requires the app to target that field explicitly. Duplicate registrations at the same layer and target are reported; explicit replacement must have defined ownership and restoration semantics rather than last-write-wins behavior.

## 5. Discovery and automatic application

1. Scan configured convention directories and emit imports/contributions. Do not execute contribution modules or inspect their runtime exports during discovery.
2. Validate descriptor shapes in the runtime normalization phase, with the source filename in errors. Static build checks can enforce import boundaries without evaluating modules.
3. Infer contribution ownership and app/plugin layer from the contributing module.
4. Install descriptors into the same services exposed through Core. Settings-specific interpretation remains in the optional Settings integration.
5. Resolve registered renderers automatically when SettingsView renders. No per-file setup or repeated renderer props are required.
6. Removing a contribution releases only its registrations and restores the appropriate fallback.

Descriptors explicitly name their target through a typed field reference, field type, section key or view part. Matching filenames do not imply matching targets. Packaged plugins may export contributions explicitly without source scanning. Reuse current folder-kind mapping, directory overrides and runtime normalizer patterns where verified; do not add a parallel loader.

Development refresh may rebuild/remount a runtime. Incremental hot registration and preservation of all in-memory state must not be promised until verified or implemented.

## 6. First render, SSR and hydration — required design work

Static descriptor imports alone do not guarantee that renderers are ready before the first render. Constructing a service with initial descriptors is also insufficient if the service itself is only created after mount.

For SSR hosts such as Next.js, the UI integration must expose an initialized, side-effect-free renderer snapshot before the server render and first client render. This is UI rendering compatibility, not a requirement for a backend Preferences plugin. Equivalent inputs must resolve equivalent renderers before and after mount. No process-global mutable registry may leak overrides across requests. The exact construction/provider path must be checked against the existing runtime before implementation; this proposal does not claim that current service timing meets this requirement.

Post-mount dynamic overrides remain supported but are distinct from initial declarative configuration. Existing service dependency ordering should be reused rather than rebuilt.

## 7. Data registration, persistence and cleanup

Register collections by lifecycle owner independently of their sections. Multiple legitimate owners of the same definition require reference-aware ownership and conflict checks. Removing the last section does not remove an owned data collection. Plugin removal must not implicitly delete persisted preferences.

Existing Core ownership manages service and contribution cleanup. View unmount releases view subscriptions only. Outstanding responses must not update a new user/organization context.

Proposed save semantics: at most one in-flight write per key; coalesce newer desired values into a follow-up write rather than reject solely because a write is pending. Specify promise completion, failure and cancellation behavior before implementation. Controls may keep local drafts and commit on completion. Application-wide live preview is optional and needs explicit revert rules for Escape, unmount, context change and failed commits. Cross-device revision checks are a separate extension.

```text
Settings UI -> AppPreferences -> Transport
                                  -> Server identity/access checks
                                  -> Backend-owned validation
                                  -> Storage adapter
```

## 8. Scope decision: client App Preferences, independent backend

This decision supersedes earlier server-integration proposals. App Preferences is a client application feature, not a server plugin framework. It owns user-facing values, presentation and replaceable storage. No Preferences installation is required on the backend.

**Configuration** is UI-free, developer-controlled technical configuration. Server-specific configuration belongs to the existing Configuration mechanism. This does not imply that Configuration is forbidden in client applications; it is distinct from persisted user choices.

**User preferences** such as theme, locale and layout belong to Preferences. For remote persistence, the client storage adapter calls the backend API. That independently developed API owns authentication, authorization, validation and database access. A local adapter remains possible when remote persistence is unnecessary.

```text
Client Preferences -> Storage adapter -> Backend API -> Backend storage
                                         identity/access/validation
Server technical setup -> Existing Configuration mechanism (no settings UI)
```

Not required in the current scope:
- A server-side Preferences plugin or runtime.
- Generated server definition lists or mandatory shared client/server schemas.
- Shared plugin enablement across independent client and server projects.
- A generic Preferences server handler or database-adapter catalog.
- General environment-aware Core discovery changes.

Optional schema reuse can be considered for a particular backend integration, but it is not a package requirement. Definitions and renderers stay separately organized for clarity and reuse, not to satisfy mandatory server contract generation.

The user has approved renaming the existing Settings package/plugin to **App Preferences** as part of the implementation handoff. Update the existing implementation; do not create a second preferences plugin or store.

Implementation target: upgrade the existing Settings implementation, now located at `packages/app-preferences` (`@bitakit/app-preferences`). Use `AppPreferences` for the renamed public value service. Audit related public symbols and update consumers, workspace dependencies, exports, build/test scripts, documentation and the lockfile consistently. Existing Settings names elsewhere in this document are illustrative references to this same implementation, not a separate plugin.

Preserve persisted preference IDs, storage keys and user values. Do not mechanically rename persisted identifiers or `/settings` routes. If a runtime plugin/service identifier must change, migrate all consumers explicitly and document compatibility. Configuration remains separate and keeps its current name.

## 9. Implementation sequence and verification

1. Verify current APIs and lifecycle/discovery timing; identify concrete gaps.
2. Stabilize preference definitions, independent owner-based registration and the client storage adapter contract while preserving existing field compatibility.
3. Add the typed rendering service, scoped overrides and explicit variants.
4. Resolve pre-render initialization and SSR/hydration before relying on automatic UI registration.
5. Provide default controls and replaceable section/view layouts using existing standard components and central theme tokens.
6. Integrate declarative contributions with existing Core ownership, then add client contribution discovery. No generated backend entry is required.
7. Migrate Shell appearance settings as a real consumer without duplicate preferences.
8. Apply the approved App Preferences package/API rename during implementation, migrate all consumers, and verify that existing stored values survive unchanged.

Verification targets (use the implementation-agent limits in Step 9; browser/E2E evidence is deferred to subsequent review):
- Preference data and renderer responsibilities remain separate; remote storage adapters have an explicit API contract.
- Discovery succeeds without executing contribution modules; normalizer errors identify invalid files.
- Field references infer correct value types.
- Field-specific overrides survive generic type changes; variants and plugin scopes behave as specified.
- SSR, initial client render and post-mount render resolve equivalent static renderers.
- Cleanup restores fallback renderers; closing a view preserves data registrations.
- Failed/queued saves and context changes cannot apply stale results.
- Remote persistence handles backend authorization/validation failures; no client discovery mechanism implies backend permission.
- Custom layouts retain accessibility and theme behavior.
- Existing discovery, plugin lifecycle and settings behavior remain compatible.

## 10. Development expectations and staged delivery

This is implementation guidance for a future authorized development task, not approval to begin implementation now. Keep documentation and code comments in English.

### Step 1 — Verify and map the existing implementation

Inspect current Settings, Core services, lifecycle, discovery, UI providers and Shell consumers. Identify reusable APIs, concrete gaps and existing uncommitted work before changing anything. Distinguish verified behavior from assumptions in this proposal. Do not recreate registration, dependency ordering, ownership or cleanup inside individual plugins.

Deliverable: a short implementation map and migration scope. Confirm compatibility choices and whether any proposed new infrastructure is actually necessary.

### Step 2 — Stabilize preference definitions and value ownership

Keep explicit, stable collection/field IDs independent of paths. Reuse current field implementations and established validation libraries where possible. AppPreferences remains the sole owner of confirmed preferences; sections only reference definitions. Support multiple collections in a section and automatic field ordering. Do not require developers to repeat fields in a content list.

Acceptance: typed reads/writes and validation work; renaming a file preserves keys; duplicate IDs produce actionable errors; removing a section does not remove still-owned preferences.

### Step 3 — Define the replaceable client storage boundary

Adapt existing persistence rather than introduce a backend framework. Support the existing local/remote behavior through a documented adapter contract. Remote adapters call independently owned APIs; those APIs retain their own authorization and validation. Specify loading, reset, failures, pending writes and context changes. Finalize queued-write promise semantics before implementing coalescing. Defer application-wide preview until cancellation behavior is agreed.

Acceptance: failed writes do not falsely confirm success; stale responses cannot update a different user/organization context; existing persistence remains compatible. No new Preferences server plugin, generated backend list or generic authorization subsystem.

### Step 4 — Implement the rendering service through existing Core integration

Provide a shared typed renderer service from the Settings UI integration. Use distinct typed registration and rendering operations. Preserve field-first precedence, explicit variant intent and plugin-scoped type overrides. Infer ownership from module lifecycle. Keep direct Core service access for explicit dynamic overrides; do not require private renderer registries in apps.

Acceptance: app field overrides replace plugin field renderers; generic type overrides do not; plugin type renderers cannot restyle other plugins; removal restores the correct fallback; conflicts identify their source.

### Step 5 — Establish consistent initial rendering

For SSR hosts, prepare a pure, instance-scoped initial renderer snapshot before the first render and connect the eventual service to equivalent initial state. Verify the actual provider/service construction path. Static imports or service constructor parameters alone are not proof of correct timing. Preserve request isolation; no mutable global renderer table.

Acceptance: SSR, hydration and post-mount rendering select equivalent renderers for static contributions. No default-to-custom flash caused solely by delayed registration. Dynamic overrides remain distinguishable from initial setup.

### Step 6 — Provide default views and customization contracts

Use existing standard controls and central theme tokens. Keep generic Foundation UI bindings free of copied visual primitives. Provide automatic field rendering, section defaults and a complete settings view. Expose typed bound state to custom controls and accessible pre-bound parts to section layouts. Full-view customization must reuse the same preferences/catalog/selection state. Independently replaceable navigation and content parts may be added later without changing ownership.

Acceptance: a developer can use defaults without writing UI, override one field, a type/variant, a section or the complete view without implementing persistence or manual subscriptions. Keyboard interaction, labels, focus and errors remain usable.

### Step 7 — Automate contributions with the existing discovery pipeline

Use configured convention directories to identify contribution kinds. Keep helper components outside discovery roots; migrate or configure around existing folder collisions. Discovery emits imports, never executes contribution modules. Runtime normalizers validate exports and report source paths. The optional Settings integration interprets Settings descriptors; Core stays generic.

Acceptance: adding a valid renderer file is sufficient for automatic registration and application after supported refresh, with no per-file setup. Removing it restores the fallback. Explicit registration remains available. Do not promise incremental hot updates if current refresh rebuilds the runtime.

### Step 8 — Migrate one real consumer, then remaining affected consumers

Use Shell appearance settings as the first example, reusing existing theme/layout definitions and persistence. Migrate other affected apps only after the path is verified. Preserve existing behavior and app state where currently supported. Remove superseded wiring only after consumers move; do not leave two authoritative preference stores or parallel contribution registries.

Acceptance: theme and layout still persist and render correctly, custom rendering works, and the app contains less infrastructure code. No unrelated feature additions. Include the approved App Preferences rename and verify all migrated consumers.

### Step 9 — Verify, document and report

The implementation agent is expected to run feasible unit tests, lightweight integration tests and affected typechecks. Run builds only when the available environment supports them. Cover lifecycle cleanup, renderer precedence/variants, persistence failures, context changes, initial rendering and discovery boundaries with these checks where practical.

End-to-end tests, browser automation, deployment, publishing and production-environment verification are outside this implementation handoff. They are not prerequisites for handing the implementation back for review. Preserve the behavioral acceptance criteria above, but explicitly mark browser-dependent criteria as pending subsequent review rather than claiming they passed. Do not deploy or provision infrastructure to satisfy a check.

Update the Foundation development guide and affected package documentation to match implemented APIs, removing superseded guidance. Report checks that could not run, why, and the remaining review steps. The subsequent review will assess the implementation and perform any available broader validation separately.

Deliverable: concise change summary, actual validation results and remaining limitations. Mark pseudocode as such until replaced by verified examples. Do not report a feature complete based only on a successful build.

### Deferred work

A general client/server contribution environment system, encrypted storage, cross-device conflict protocols, advanced inheritance/locks and a large adapter catalog require separate scope decisions. Do not add them as prerequisites to this client Preferences feature.
