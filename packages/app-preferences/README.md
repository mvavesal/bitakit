# @bitakit/app-preferences

The settings UI of BitaKit: generated settings pages, setting controls, the settings route with
its navigation, search and plugin overview, and the URL Actions that let navigation and Quick
Search reach every settings page.

It does not own values. Plugins declare settings with `defineSettings` in `settings.ts`;
`@bitakit/core` validates, stores and persists them (the `settings.storage` contract), and
`@bitakit/ui` exposes them through `useSetting` and `useSettingsCatalog`. This package only
renders that state and calls `set` and `reset`.

## Use it

Install the package; discovery activates its plugin (`bitakit.plugin: ./foundation`) and its
styles. Mount the route once:

```tsx
// src/app/settings/[[...section]]/page.tsx (Next.js; TanStack: a `settings.$` route)
'use client';
import { SettingsRoute } from '@bitakit/app-preferences';

export default function Page() {
  return <SettingsRoute />;
}
```

`/settings` shows the first page; `/settings/<path>` shows a section. Pathname and links come
from the framework adapter (`@bitakit/next`, `@bitakit/tanstack`), which also provides the nuqs
adapter for the search parameters. Add `@bitakit/app-preferences/locales/<lang>.json` to the
host's message catalogs.

Declare settings in any plugin (or the app) and they appear on a generated page:

```ts
// src/plugins/todos/settings.ts
import { defineSettings, setting } from '@bitakit/core';

export default defineSettings(
  {
    pageSize: setting({ default: 20, label: 'Items per page' }),
    layout: setting({
      default: 'list',
      control: 'cards',
      options: [
        { value: 'list', label: 'List', description: 'One task per row.' },
        { value: 'board', label: 'Board' },
      ],
    }),
    showDone: setting({ default: true, scope: 'device', group: 'advanced' }),
  },
  { title: 'Todos', category: 'general', order: 5, shortcut: 'Alt+Shift+T' },
);
```

- One section per module that declares visible settings or a settings page. Its URL segment is
  `path` (default: the plugin ID, `general` for the app).
- Fields render in a card; settings with a `group` get their own titled card. `hidden` settings
  stay off generated pages but keep working through `useSetting` and `<SettingField settingKey>`.
- Controls follow `control`, otherwise the value: boolean → switch, options → select, number →
  number, string → text. `radio`, `cards` and `textarea` are chosen explicitly. Other values
  need a custom page.
- Categories group the navigation: `general`, `appearance`, `account`, `organization`,
  `plugins`, `administration` in that order (`settingsCategories`); other categories follow by
  title. A section without a category is listed under `plugins`, the app under `general`.

### Replace a generated page

A plugin's `ui/settings/page.tsx` replaces its generated page. The default export receives
`{ section }` and can reuse the generated parts:

```tsx
// src/plugins/todos/ui/settings/page.tsx
import {
  SettingField,
  SettingsFields,
  type SettingsCatalogSection,
} from '@bitakit/app-preferences';

export default function TodoSettings({ section }: { section: SettingsCatalogSection }) {
  return (
    <>
      <SettingsFields section={section} exclude={['todos.layout']} />
      <SettingField settingKey="todos.layout" />
    </>
  );
}
```

The page header (title and description) is rendered around it. Controls are exported for
custom layouts; each takes `SettingControlProps<T>` (`field`, `id`, `value`, `onChange`,
`disabled`, `describedBy`) and only renders a value and reports a new one.

### Persist settings on a server

Values go through the `settings.storage` contract; browser storage is the default. A host
replaces it with one service:

```ts
// src/services/settings-storage.ts
import { defineService, settingsStorage } from '@bitakit/core';

export default defineService(
  () => ({
    // context: { scope, userId, organizationId } of the value
    async load(key, context) {
      const response = await fetch(`/api/settings/${key}?scope=${context.scope}`);
      return response.json(); // { value, writable }
    },
    async save(key, value) {
      await fetch(`/api/settings/${key}`, { method: 'PUT', body: JSON.stringify(value) });
    },
  }),
  { provides: settingsStorage },
);
```

The runtime reloads values when the `auth` contract reports another user or organization. The
server decides what is writable; the UI shows read-only settings as such.

## API

`@bitakit/app-preferences` (client components):

| Export                                                                    | Purpose                                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `SettingsRoute({ basePath?, pathname?, backHref?, linkComponent? })`      | The whole `/settings/[[...section]]` route; the base path shows the first page. |
| `SettingsShell({ basePath?, pathname?, backHref?, embedded?, children })` | Frame: sidebar with search (a drawer on narrow screens), skip link, breadcrumb. |
| `SettingsNavigation({ basePath?, pathname?, query? })`                    | The pages by category; marks the current one; a status when nothing matches.    |
| `SettingsPage({ basePath?, pathname?, unavailable? })`                    | The page at `pathname`, or the unavailable status.                              |
| `SettingsSectionPage({ section, showHeader? })`                           | Header, then the plugin's own page or the generated fields.                     |
| `SettingsFields({ section?, fields?, exclude? })`                         | Generated fields in cards, grouped by `group`; empty state.                     |
| `SettingField({ field } \| { settingKey })`                               | Label, description, control, saving state, inline error and reset.              |
| `SwitchControl` … `NumberControl` (seven controls)                        | Standard controls: `(props: SettingControlProps<T>)`.                           |
| `controlFor(field)`                                                       | The control a field uses, or undefined.                                         |
| `SettingsOverview({ basePath?, query?, showSearch? })`                    | Every page with its fields, searchable, with an empty state.                    |
| `PluginsOverview()`                                                       | Installed plugins; one plugin's details and settings with `?plugin=<id>`.       |
| `settingsCategories`                                                      | Known categories and their order.                                               |
| `SettingControlProps`, `SettingsCatalogSection`, `SettingsCatalogField`   | Types.                                                                          |

The seven controls are `SwitchControl`, `SelectControl`, `RadioControl`, `CardsControl`,
`TextControl`, `TextareaControl` and `NumberControl`. `embedded` on `SettingsShell` drops the
back link and keeps the sidebar open on wide screens, for a host dialog.

`@bitakit/app-preferences/foundation` (default export): `appPreferencesPlugin({ basePath?, groups? })`.
`basePath` (default `/settings`) must match the route; `groups` (default `['navigation']`) are
the Action groups of the "Settings" entry (an empty list keeps it out of navigation).

### URL Actions

The plugin's setup projects the catalog into the ActionList, so Quick Search and navigation need
no settings code:

- `settings.section.<id>` per page: href `<basePath>/<path>`, the section's icon, order and
  `shortcut`, group `settings.pages`, headed by `settings.category.<category>`.
- `app-preferences.settings`: the "Settings" entry (href `basePath`) in `groups`.
- `settings.plugins.<id>` per plugin: href `<basePath>/plugins?plugin=<id>`, group
  `settings.plugins`, headed by "Plugins" (`settings.plugins.heading`).

Each carries `destinationMetadata` (`settings` or `plugin` and the owning plugin). Titles follow
the translator and every registration leaves with the plugin.

### Query parameters

`q` is the settings search (sidebar and overview), `pluginSearch` the plugin list search and
`plugin` the plugin shown in the overview. Components that read them render inside Suspense.

## Translations

The catalog resolves `<plugin>.settings.<name>.label|description`,
`<plugin>.settings.<name>.options.<value>.label|description`, `<plugin>.settings.title|description` (the app uses
`app`). This package adds:

- `<plugin>.settings.groups.<group>`: titles of field groups (default: the group name).
- `settings.categories.<id>.title`: category titles (default: the ID in title case).
- `plugins.<id>.name|description`: plugin names in the overview and search.
- `app-preferences.ui.*`: every text this package renders (`locales/en.json`, `locales/de.json`).

## Source map

| Path                                       | Responsibility                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `src/index.ts`, `src/foundation.ts`        | Public entries                                                                  |
| `src/plugin.ts`                            | `appPreferencesPlugin`: own section, Plugins page, setup                        |
| `src/navigation.ts`                        | URL Action projection of the catalog                                            |
| `src/catalog.ts`                           | `settingsCatalog()`: the headless twin of `useSettingsCatalog()`                |
| `src/composition.ts`                       | Stopgap: finds the composed modules for setup (see Limitations)                 |
| `src/categories.ts`, `src/search.ts`       | Category order and grouping, search matching                                    |
| `src/paths.ts`, `src/text.ts`, `src/id.ts` | Paths, English texts and translation helpers, plugin ID                         |
| `src/components/settings-*.tsx`            | Route, shell, navigation, pages, fields, overview                               |
| `src/components/setting-field.tsx`         | One setting: state, write, error, reset                                         |
| `src/components/controls.tsx`              | Standard controls and `controlFor`                                              |
| `src/components/plugins-overview.tsx`      | Plugin list and details                                                         |
| `src/components/ui/`                       | shadcn Radix Vega primitives this package needs beyond `@bitakit/ui/components` |

## Limitations

- Core passes `setup` no module list yet. `src/composition.ts` finds the runtime that composed
  the plugin through an app extension and the services view; it goes away once Core exposes the
  composed modules (with their settings declarations) to setup.
- Projected titles follow the `i18n` service. A host that translates only through the
  `translate` prop of `FoundationProvider` gets English Action titles; the pages are translated.
- `SettingsShell` owns a `SidebarProvider`. Inside another sidebar layout the central provider
  reports its `Mod+B` shortcut as already registered.

## Validation

```sh
npm test --workspace @bitakit/app-preferences   # build, type check, node --test (jsdom)
```

Dependencies: `@bitakit/core`, `@bitakit/ui`, `nuqs`, `radix-ui`, `reicon-react`; peer `react`.
Consumers: apps with a settings route, `@bitakit/shell`, Quick Search (through the projected
Actions).
