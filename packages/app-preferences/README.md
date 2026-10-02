# @bitakit/app-preferences

Client-side App Preferences: typed definitions, one owner of confirmed values (`AppPreferences`),
a replaceable storage boundary, and React views whose rendering can be customised per field,
type, section or view. The package has no router or database dependency. Its visual entry owns standard shadcn Radix Vega controls; its core entry has no React runtime dependency. Foundation
integration is optional and lives in `@bitakit/app-preferences/foundation`.

## Entry points

| Entry                                 | Contents                                                                                        | Depends on                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| `@bitakit/app-preferences/core`       | Definitions, builders, sections, `AppPreferences`, storage adapters. No React runtime import.   | –                         |
| `@bitakit/app-preferences`            | Everything in `core` plus React provider, hooks, renderer registry, default controls and views. | React                     |
| `@bitakit/app-preferences/foundation` | `appPreferencesPlugin`, typed services, installers, discovery normalizers, SSR bridge.          | Core, UI (optional peers) |
| `@bitakit/app-preferences/discovery`  | `settingsDiscovery()` kinds for `bitakit.config.ts` (Node, no module execution).                | –                         |
| `@bitakit/app-preferences/actions`    | Optional Core Actions adapter (`bindSettings`).                                                 | Core                      |

## Default workflow with Foundation

When installed as a direct dependency, the package contributes its plugin and discovery kinds automatically.
The default instance uses browser localStorage with the `foundation.settings.` prefix. Without browser
storage, defaults are read-only. This is device-local storage, not authenticated server persistence.
Pass a configured plugin through Next FoundationProvider additionalPlugins to replace this default.
ID-free local definitions use the plugin ID and relative file path:

```ts
// src/plugins/documents/settings/editor.ts
export default defineSettings({
  fields: { autosave: booleanField({ defaultValue: true }) },
});
```

```tsx
const app = useFoundationApp();
const autosave = app.settings.documents.editor.autosave;
await autosave.set(false);
// Reading directly is imperative; the binding subscribes to confirmed state.
const enabled = autosave.get();
<SettingToggle setting={autosave} />;
```

Discovery supplies the key `documents.editor.autosave`. An explicit collection ID replaces
that inferred prefix. Preserve explicit IDs when moving persisted definitions; file renames
otherwise select new storage keys. Root app definitions use the `app` prefix. Existing explicit
collections, section references and direct Setting bindings remain supported. ID-free declarations
are resolved by discovery; use an explicit ID for a collection referenced directly from a section.
References delegate to the current AppPreferences owner, and bindings retain the original definition
identity. Removed definitions cannot be read or written through a retained reference.

The following optional configuration is only needed to customize discovery:

```ts
// bitakit.config.ts
import { defineBitaKit } from '@bitakit/core/discovery';
import { settingsDiscovery } from '@bitakit/app-preferences/discovery';
export default defineBitaKit({ kinds: settingsDiscovery() });
```

```text
src/                          # the same layout works inside every plugin source root
  settings/editor.ts          # preference definitions (default export)
  sections/editor.tsx         # settings sections, may use React icons (default export)
  renderers/editor.tsx        # optional renderer descriptors (default export)
  components/settings/…       # helper components; not discovered
```

```ts
// src/settings/editor.ts
import { z } from 'zod';
import {
  booleanField,
  choiceField,
  defineSettings,
  numberField,
} from '@bitakit/app-preferences/core';

export default defineSettings({
  id: 'editor', // durable; keys are `editor.autosave`, `editor.pageSize`, …
  scope: 'user',
  fields: {
    autosave: booleanField({
      title: 'Auto save',
      titleKey: 'editor.autosave.title',
      defaultValue: true,
    }),
    pageSize: numberField({ defaultValue: 20, schema: z.number().int().min(5).max(100) }),
    density: choiceField({
      options: ['comfortable', 'compact'],
      defaultValue: 'comfortable',
      presentation: { variant: 'cards', columns: 2 },
    }),
  },
});
```

```tsx
// src/sections/editor.tsx
export default defineSettingsSection({ id: 'editor', title: 'Editor', settings: [editorSettings] });

// src/renderers/editor.tsx
export default defineSettingsRenderers({
  fields: [
    fieldRenderer(
      editorSettings.fields.pageSize,
      ({ value, setValue, disabled, id, describedBy }) => (
        <NumberPicker
          id={id}
          aria-describedby={describedBy}
          value={value}
          onCommit={setValue}
          disabled={disabled}
        />
      ),
    ),
  ],
});
```

```tsx
// Optional custom persistence; replaces the automatically discovered default plugin.
const [settings] = useState(() =>
  createAppPreferences({ storage: createLocalStorage({ prefix: 'my-app.settings.' }) }),
);
// Create plugins once per settings instance; a new plugin object remounts its provider.
const plugins = useMemo(() => [appPreferencesPlugin({ settings })], [settings]);
// FoundationProvider here is imported from @bitakit/next.
<FoundationProvider additionalPlugins={plugins}>
  <SettingsView />
</FoundationProvider>;
```

The plugin owns SettingsProvider when no host provider exists. An explicit outer
SettingsProvider remains supported for identity-scoped storage and retains its context.
The plugin publishes the same settings service as `app.services.preferences`; it does not create
another preference store. Its factory return type preserves this public contract.

Discovery emits imports only; it never executes contribution modules. The generated file calls
the runtime normalizers (`discoverSettings`, `discoverSettingsSections`, `discoverSettingsRenderers`),
which validate each default export and name the source file in errors. Installers register the
values for the contributing module: ownership and app/plugin layer come from the module, never from
a caller-supplied string. Folder names can be changed with
`settingsDiscovery({ directories: { settings: 'preferences' } })`; a plugin manifest can override
one kind with `entries: { 'settings.renderers': 'ui/renderers' }`. Packaged plugins pass the same
values explicitly as `contributions: { settings, 'settings.sections', 'settings.renderers' }`.
Adding a valid file is enough after the development refresh regenerates discovery; removing it
restores the fallback. Hot registration without a runtime rebuild is not promised.

## Definitions

- `defineSettings({ id, scope, fields })` returns a `SettingsCollection` with typed `fields`. IDs are
  explicit and independent of file paths, so renaming a file keeps keys. Invalid IDs, field names
  and default values fail with actionable errors.
- Builders: `booleanField`, `numberField`, `textField`, `choiceField` (option values are inferred as a
  literal union; plain strings get humanized labels). Titles default to the humanized field name.
- `schema` accepts any Standard Schema validator (Zod, Valibot, ArkType). Validation is synchronous;
  issues are surfaced as `SettingValidationError.issue`.
- Texts are literal strings or `{ key, fallback }`. The views also try conventional keys through the
  existing translator: `<key>.title`, `<key>.description`, `<key>.options.<value>` and
  `settings.sections.<id>.title|description`.
- `presentation` carries plain hints only: `order`, `variant`, `columns`, `min`, `max`, `step`.
- The existing classes (`SelectSetting`, `ToggleSetting`, `TextSetting`, `NumberSetting`) remain the
  field implementations and the legacy constructors keep working.

## Ownership and registration

`AppPreferences` is the only owner of confirmed values.

- `settings.register(source, { owner, origin? })` registers a collection, definition or list for an
  owning module. Registrations are reference counted: several modules may own the same definition
  object; it stays registered until the last owner, section reference or pin is released. A
  different definition under an existing key or collection ID is rejected and the error names both
  origins. `ownersOf(setting)` lists the owners.
- Sections only reference definitions. Removing a section, closing a view or removing a plugin never
  deletes stored values; unregistering never calls storage.
- Legacy APIs remain: `settings.add(new SettingsSection({ groups }))` registers the grouped
  definitions for the section's lifetime, and `createAppPreferences({ definitions })`/`define()` pin
  definitions for the instance lifetime.
- Section fields are ordered by `presentation.order`, then collection order, then declaration order;
  unordered fields follow ordered ones.

## Writes and promise semantics

`set(setting, value)` validates first, then queues. At most one write per key is in flight; a newer
value replaces the queued one. The returned promise:

| Result         | Meaning                                                                            |
| -------------- | ---------------------------------------------------------------------------------- |
| `'saved'`      | This value was written and is now the confirmed value.                             |
| `'superseded'` | A newer value replaced this one before it was sent; resolves once the key settles. |
| `'cancelled'`  | The context changed or the definition was removed; a late success is not applied.  |
| rejection      | Validation failed, the setting is not writable, or this value's own write failed.  |

Confirmed values change only after a successful write. Failures keep the confirmed value and set
`state.error`; a queued value still runs afterwards. `activate(context)` starts a new session: queued
writes resolve `'cancelled'`, late loads and writes of the previous context are ignored, and a late
failure rejects its own promise without touching the new context. `reset(setting)` uses
`storage.reset` when available and otherwise saves the default. A replaced definition waits for
the previous write of the same key. Application-wide live preview is not implemented.

## Storage boundary

```ts
interface SettingsStorage {
  load(key, context): Promise<{ value?: SettingValue; writable: boolean }>;
  save(key, value, context): Promise<void>;
  loadMany?(keys, context): Promise<Record<string, StoredSetting>>; // one request on activation
  reset?(key, context): Promise<StoredSetting>; // remove the override
}
```

`activate` uses `loadMany` when present and falls back to `load` for keys missing from its result.
Adapters: `createLocalStorage({ prefix, store?, namespace? })` (JSON values, corrupt entries fall back
to the default, quota errors reject) and `createMemoryStorage({ values?, writable? })`. Remote adapters
call an independently owned API that authenticates, authorizes and validates on its own; client
registration or discovery never grants backend permission, and backend rejections surface as failed
writes. Environment defaults (`environmentDefault`) are resolved by trusted server code.

## Rendering

`SettingsView` (navigation plus content with one selection state), `SettingsSectionView` and
`SettingsField` render without UI code. Controls receive typed props (`value`, `setValue`, `reset`,
`disabled`, `pending`, `error`, `options`, ids) and never implement storage or subscriptions.
Pending writes do not disable controls; the displayed value is a local draft until the write
settles, and a failed write reverts to the confirmed value with an alert. Text and number controls
commit on blur or Enter and restore the confirmed value on Escape.

Built-in controls use standard shadcn Radix Vega components with central theme tokens: `boolean` (checkbox, variants
`checkbox`, `switch`), `choice` (select, variants `select`, `radio`, `cards`), `text` (input, variants
`input`, `textarea`), `number` (input), and `multi-choice` (checkboxes or cards).
There is no host component catalog; field and type renderer overrides provide customization.

Resolution for a field is deterministic:

1. App field override
2. Field owner's plugin field renderer
3. App type + requested variant
4. Owner's plugin type + requested variant
5. Built-in requested variant
6. App generic type
7. Owner's plugin generic type
8. Built-in type default

A requested variant never falls back to a generic renderer; an unknown variant is a configuration
error shown inline. Plugin type and field renderers apply only to fields the plugin owns; plugin
section renderers only to sections it contributed; view renderers (`settings`, `section`, `field`)
are app-only. Duplicates on the same layer and target are rejected with both sources. Removing a
registration restores the next fallback.

Section renderers receive pre-bound items: `label`, `description`, `control`, `feedback`, `resetControl`, complete
`content`, `state`, texts and `ids`. A custom layout may render its own title element with
`item.ids.labelId`; controls are labelled by id, so associations survive.

Imperative registration from `setup` goes through the same service and is scoped:

```ts
// setup.ts
import type { Setup } from '@bitakit/core';

const setup: Setup = ({ app, services }) => {
  getService(services, settingsRendererService)
    .scoped(app)
    .registerType('boolean', { component: MyCheckbox });
};
export default setup;
```

The layer and owner come from the runtime-issued scope (`scopeModule`), so a plugin cannot register
as the application; registrations end with the scope.

Without Foundation, `createSettingsRenderers(appSet)` and `<SettingsUIProvider renderers={…}
translate={…} messages={…}>` supply the same service to the views.

## Initial render and SSR

Services are created on mount, so `appPreferencesPlugin`'s provider supplies a pure, instance-scoped
snapshot computed from `runtime.contributionsOf(kind)` in install order before mount. Server
render, hydration and the mounted runtime resolve the same renderers, sections and definitions for
static contributions; there is no default-to-custom flash and no process-global renderer table.
Values from client storage load after activation, so controls render disabled with defaults first.
Imperative (post-mount) registrations are dynamic and appear after mount.

## Legacy React API

`useSetting`, `SettingBinding`, `SettingSelect`, `SettingToggle`, `SettingInput`, `SettingsPanel` and
`SettingsSectionContent` keep their behavior. `SettingsProvider` keeps the initial catalog for
hydration.

## Optional Actions adapter

```ts
const createSettingAction = bindSettings(settings);
actions.register(
  createSettingAction({ id: 'theme.set', title: 'Change theme', setting: themeSetting }),
);
```

The action mirrors the confirmed value and writability; writes use `AppPreferences.set`.

## Source layout

| Location                           | Responsibility                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `types.ts`, `schema.ts`, `text.ts` | Shared contracts, Standard Schema types, localized text resolution                             |
| `fields/`                          | `Setting` base and concrete definitions; `builders.ts` for `defineSettings` and field builders |
| `catalog/`                         | Sections, catalog registration and navigation projection                                       |
| `app-preferences.ts`               | Confirmed values, ownership, queued writes, sessions and subscriptions                         |
| `storage.ts`                       | Local and memory storage adapters                                                              |
| `renderers/`                       | Headless registry and resolution, typed builders, prop contracts, built-in set                 |
| `react/`                           | Provider, UI context, messages and the item binding hook                                       |
| `components/`                      | Built-in controls, default views and legacy bindings                                           |
| `plugin.tsx`                       | Standard plugin composition and contribution installers                                        |
| `services/renderers.ts`            | Shared service keys and scoped renderer registration                                           |
| `providers/foundation.tsx`         | Initial snapshot and runtime provider bridge                                                   |
| `foundation/`                      | Optional entry, ownership normalization and discovery normalizers                              |
| `discovery.mjs`                    | Discovery kinds for `bitakit.config.ts`                                                        |

Run `npm test` for definitions, ownership, queue semantics, storage adapters, renderer precedence,
views, SSR equivalence and Foundation integration.

## App Preferences migration and standard controls

The package is now `@bitakit/app-preferences`, the plugin factory is `appPreferencesPlugin`,
the plugin ID is `app-preferences`, and the confirmed-value owner is `AppPreferences`
(created with `createAppPreferences`). All workspace consumers use the new package.
Existing `settings` and `settings.renderer` service keys, contribution kinds, persisted field keys,
local-storage prefixes and `/settings` routes intentionally remain stable. There is no second store.

Controls use the repository's standard shadcn Radix Vega primitives with Reicon and central theme
classes, owned by this optional visual package under `components/ui`. Deviation: unchecked radio
items have no dark-mode fill (`dark:bg-input/30` removed); the central theme keeps them transparent
so they match the card or surface they sit on. Customization uses the renderer
service rather than a host component catalog. Shell and Web reuse the same card control; Shell only
supplies its icons. Web enables the plugin and renderer discovery while preserving its existing
localized catalog, server storage and intercepted routes.

`multiChoiceField({ options, defaultValue: [], presentation })` stores an immutable array of declared
option values, validated using Zod. Both single and multiple choices support `orientation` (`horizontal`
or `vertical`), optional responsive `columns`, and `cards`; multiple choices also support `checkbox`.
React icons can be supplied in a renderer's resolved options, not in the shared field definition.
Custom plugin `defaults` seed both the pre-mount snapshot and mounted service identically.

Public access responsibilities: `foundation/app-access.ts` projects discovered definitions;
`fields/reference.ts` delegates reads/writes and preserves UI binding ownership. The Core
app extension contract contains no Settings implementation or React dependency.

### Individual reset

`react/items.tsx` binds a standard `resetControl` for each registered setting. Default field views
render it automatically; section renderers place `item.resetControl` once beside the same item's
control and feedback. Shell's appearance cards use this bound part without implementing persistence.
Control renderers already receive the identical `reset()` callback; a custom layout that renders
its own reset should omit the bound part to avoid duplication.

Reset calls the existing `AppPreferences.reset`: remove the persisted override where supported,
otherwise save the declared default. It remains available when the displayed value equals the
default because an explicit persisted override can still exist. The button is disabled before
loading, during writes, in disabled sections and for read-only settings. Errors use the existing
field feedback and allow retry; drafts display the requested default until storage confirms or
rejects it. No other field, account form or section is reset.

With the Foundation plugin, catalog sections automatically expose URL Actions under `settings.section.<id>`. Titles, descriptions, icons, categories, visibility and enabled state follow the existing catalog; removal unregisters the Action. Hosts do not register these links manually. Standalone App Preferences remains independent of Foundation.

A section may set `navigation: { id, groups, shortcut }` to preserve a public Action ID, add placements or configure a shortcut. Its title, icon, description, URL and guards still come from the section itself; do not create a separate URL Action for the same settings page.

### Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as
`./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration
with `mergePluginMessages`; app catalogs override matching keys in the same locale.
