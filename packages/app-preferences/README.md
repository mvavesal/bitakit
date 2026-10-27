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
export default defineSettings({ pageSize: setting({ default: 20 }) });
```

Open `/settings/todos`: its navigation entry, page and number control are generated.
Read the value with `useSetting('todos.pageSize')` in React. Start here; all options below are optional.

### Later: labels, controls and categories

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

- A default section per module that declares visible settings or a settings page; optional additional pages share the same catalog. Its URL segment is
  `path` (default: the plugin ID, `general` for the app).
- Fields render in a card; settings with a `group` get their own titled card. `hidden` settings
  stay off generated pages but keep working through `useSetting` and `<SettingField settingKey>`.
- Controls follow `control`, otherwise the value: boolean → switch, options → select, number →
  number, string → text, a list → list (add and remove short texts), a list with options →
  checkboxes (several of them). `radio`, `cards` and `textarea` are chosen explicitly. Other
  values (objects) need a custom page.
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

### Settings extension slots

Install the ordinary `appPreferencesPlugin` (automatically discovered in generated hosts).
Its existing catalog now projects one navigation Action and one keyed body per visible page.
Authors keep `settings.ts` and `ui/settings/page.tsx`; no manual body or navigation registration.

| Slot                                | Content         | Context/selection                                                    |
| ----------------------------------- | --------------- | -------------------------------------------------------------------- |
| `app-preferences.navigation`        | Actions         | Catalog pages plus explicitly placed destination Actions             |
| `app-preferences.navigation.footer` | Components      | Sidebar widgets                                                      |
| `app-preferences.page.body`         | Keyed component | `entryKey` is the catalog page ID; maintained by the catalog adapter |
| `app-preferences.page.after`        | Component list  | `{ pageId }`; several ordered extensions can target the same page    |
| `app-preferences.page.toolbar`      | Actions         | `{ pageId }` maps to each Action's input                             |

```tsx
// audit/ui/slots/app-preferences.page.after.tsx
import type { SlotPredicate } from '@bitakit/core';
import type { SlotProps } from '@bitakit/ui';
export const order = 20;
export const when: SlotPredicate<'app-preferences.page.after'> = ({ payload }) =>
  payload.pageId === 'billing/history';
export default function Audit({ payload }: SlotProps<'app-preferences.page.after'>) {
  return <p>History for {payload.pageId}</p>;
}
```

`when` is a pure per-outlet predicate. It receives the parsed payload and does not change global
attachment state. For reactive behavior within a widget use the existing service/setting hooks;
for toolbar Actions use `visible`/`enabled` and the mapped input.

```ts
// audit/actions/export.ts
export default defineAction<string>({
  title: 'Export',
  slots: [{ slot: 'app-preferences.page.toolbar', input: ({ payload }) => payload.pageId }],
  visible: ({ input }) => input === 'billing/history',
  execute: ({ input, services }) => services.audit.export(input),
});
```

A custom page still receives `{ section, renderField }`. `showHeader: false` gives the page
ownership of its heading. Additional pages retain IDs such as `billing/history`, independently
of URL overrides and translations; each additional page can also specify `showHeader`.

```tsx
// billing/ui/settings/page.tsx
export default {
  component: BillingPage,
  boundary: BillingAccess, // ({ children }) => allowed ? children : existing access UI
  pages: [{ id: 'history', title: 'History', component: HistoryPage }],
};
```

The optional boundary encloses the header, toolbar, body and extensions. Extra pages inherit it
or declare their own. A default component export can use `export const boundary = BillingAccess`.
Reuse the owning integration's access policy; this UI boundary does not authorize storage or
server operations. First-party account/organization pages share their existing guards with their
extensions. Duplicate body keys fail; extend `page.after` instead of replacing a projected body.

Navigation uses live Action controls with native links and guarded `linkProps({ href })` for
route-base/search adaptation. Existing nuqs search, fields, category grouping and translation
remain. A plain destination Action uses `slots: ['app-preferences.navigation']` and defaults to
the General category; groups never choose its placement. Search for catalog pages still includes
field labels/options. Source or host removal releases projections through the existing lifecycle;
compatible explicit host updates also rebuild composition-reading projections. Structural changes
still require whole-composition replacement.

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
| `SwitchControl` … `CheckboxesControl` (nine controls)                     | Standard controls: `(props: SettingControlProps<T>)`.                           |
| `controlFor(field)`                                                       | The control a field uses, or undefined.                                         |
| `SettingsOverview({ basePath?, query?, showSearch? })`                    | Every page with its fields, searchable, with an empty state.                    |
| `PluginsOverview()`                                                       | Installed plugins; one plugin's details and settings with `?plugin=<id>`.       |
| `settingsCategories`                                                      | Known categories and their order.                                               |
| `sectionHref(basePath, section)`, `settingHref(basePath, section, key)`   | Links to a page, or to one setting on it (see Linking to a setting).            |
| `settingAnchor(key)`                                                      | A setting's anchor, `setting-<key>`: the id of its field.                       |
| `SettingControlProps`, `SettingsCatalogSection`, `SettingsCatalogField`   | Types.                                                                          |

The nine controls are `SwitchControl`, `SelectControl`, `RadioControl`, `CardsControl`,
`TextControl`, `TextareaControl`, `NumberControl`, `ListControl` and `CheckboxesControl`. `embedded` on `SettingsShell` drops the
back link and keeps the sidebar open on wide screens, for a host dialog.

`@bitakit/app-preferences/foundation` (default export): `appPreferencesPlugin({ basePath?, groups?, slots?, searchShortcut? })`.
`basePath` (default `/settings`) must match the route; `groups` (default `['navigation']`) are
the logical groups of the "Settings" entry. `slots` selects its placement targets; by default it joins Shell navigation when installed. `slots: []` omits navigation placement. Explicit unknown targets fail. `searchShortcut` (default `/`)
is the `app-preferences.search` Action's key: while Settings is open it focuses the settings search,
which shows the key while empty; `false` turns it off.

### URL Actions

The fixed `app-preferences.settings` destination is included in the public `ActionMap` and
takes no input. It can be bound directly with `ActionLink` in strict generated apps.
Use `slots: []` when the host supplies its own placement instead of Shell's main navigation.

The plugin's setup projects the catalog into the ActionList, so Quick Search and navigation need
no settings code:

- `settings.section.<id>` per page: href `<basePath>/<path>`, the section's icon, order and
  `shortcut`, group `settings.pages`, headed by `settings.category.<category>`.
- `app-preferences.settings`: the "Settings" entry (href `basePath`) in `groups`.
- `settings.plugins.<id>` per plugin: href `<basePath>/plugins?plugin=<id>`, group
  `settings.plugins`, headed by "Plugins" (`settings.plugins.heading`).

Each carries `destinationMetadata` (`settings` or `plugin` and the owning plugin). Titles follow
the translator and every registration leaves with the plugin.

### Linking to a setting

Every generated field has the id `setting-<key>`, so a link can name one setting:
`settingHref('/settings', { path: 'theme' }, 'shell.theme')` gives
`/settings/theme#setting-shell.theme`. Opening it, or changing the hash on the page, scrolls the
field to the middle (without animation when reduced motion is set), focuses its control and
highlights it briefly with the theme's focus ring. Useful for search results, help texts or an
assistant that sends people to one setting.

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
| `src/navigation.ts`                        | Owned navigation Action and keyed body projection                               |
| `src/catalog.ts`                           | `settingsCatalog()`: the headless twin of `useSettingsCatalog()`                |
| `src/slots.ts`                             | Typed Settings navigation, body, extensions, toolbar and footer definitions     |
| `src/categories.ts`, `src/search.ts`       | Category order and grouping, search matching                                    |
| `src/paths.ts`, `src/text.ts`, `src/id.ts` | Paths, English texts and translation helpers, plugin ID                         |
| `src/components/settings-*.tsx`            | Route, shell, navigation, pages, fields, overview                               |
| `src/components/setting-field.tsx`         | One setting: state, write, error, reset                                         |
| `src/components/controls.tsx`              | Standard controls and `controlFor`                                              |
| `src/components/plugins-overview.tsx`      | Plugin list and details                                                         |
| `src/components/ui/`                       | shadcn Radix Vega primitives this package needs beyond `@bitakit/ui/components` |

## Limitations

- Explicit compatible `runtime.reconcilePlugins` updates restart the composition-reading
  catalog projection; supported structural changes use the same awaited lifecycle. Provider
  config prop changes still replace the runtime.
  `scopeModules`, `scopeTranslation` and scope-owned lifecycle observation reuse the catalog.
  Both service and provider translations update titles without replacing body attachments.
- `SettingsShell` owns a `SidebarProvider`. Inside another sidebar layout the central provider
  reports its `Mod+B` shortcut as already registered.

## Validation

```sh
npm test --workspace @bitakit/app-preferences   # build, type check, node --test (jsdom)
```

Dependencies: `@bitakit/core`, `@bitakit/ui`, `nuqs`, `radix-ui`, `reicon-react`, `zod`; peer `react`.
Consumers: apps with a settings route, `@bitakit/shell`, Quick Search (through the projected
Actions).

### Multiple pages from one plugin

Keep the existing `ui.settings.component` for the default page. Add `ui.settings.pages`
with entries `{ id, component, title, description?, path?, category?, order?, icon?, shortcut?, showHeader?, boundary? }`.
Paths are relative to `/settings`; without `path`, a page uses `<default section path>/<id>`.
Each page has a stable catalog ID `<plugin>/<id>` while destination metadata retains the
owning plugin ID. Additional pages do not duplicate setting fields or runtime stores.
The React hook and navigation actions use the same catalog implementation in `@bitakit/ui`.
A discovered `ui/settings/page.tsx` may export this object as its default export instead of a
component. Existing component exports continue to work. The settings host owns the heading;
content components should retain their forms and toolbars without duplicating the page title.
Categories group navigation; they do not grant access. Pages and server APIs enforce permissions.

### Plugin overview layout

The settings shell constrains the viewport; the plugin list scrolls independently while its
header and search stay visible. Plugin details list every catalog page by owning plugin ID,
including App Preferences' own page. Versions use the standard Badge when metadata supplies
a version; missing versions are not invented. `ui.settings.showHeader: false` lets a custom
page own its header. The shared `PageHeader.before` slot places back navigation above the title.

### Plugin catalog metadata

Plugin metadata may declare `tags: readonly string[]` and `coverImage`. Tags are optional,
case-sensitive catalog labels (prefer short stable lowercase names such as `security`),
not permissions or dependencies. The catalog derives the tag choices from installed plugins;
there is no tag registry. Multiple selected tags match any selected label and combine with text search; `pluginTag` and
`pluginSearch` are nuqs URL state and survive detail/back navigation. Existing plugins without
tags remain visible when no tag is selected. Names, descriptions and tags participate in text search.

Declare metadata in `definePlugin({ metadata: { tags, coverImage } })`, local
`plugin.config.ts` metadata, or the package.json `tags` / `coverImage` fields consumed by
`bitakit build`. Discovery and package builds preserve both fields. Covers are optional;
missing, unsafe or failed images use the plugin icon (or the standard puzzle fallback).

App Preferences uses the shared standard Card and Item primitives from `@bitakit/ui/components`,
Badges and Radix ScrollArea. Compact groups use `sm` rows with separators between entries only;
there is no extra group gap. The viewport keeps a logical end gutter clear of the scrollbar.
Search and page headings stay outside the scroll viewport. The same ScrollArea is exported
for composition; list scrolling is owned by that viewport rather than a nested native
scroll container. Preserve the theme focus token and Radix data-orientation selectors when
updating registry components. No app CSS is needed.

Each row places a declared version beside the plugin name, followed by the description,
optional author and wrapping tags. Missing versions are omitted from the list; the detail
page reports them as unspecified. Names, descriptions and long tags can wrap at narrow widths.
The semantic list uses `.app-preferences-plugins`; each linked row uses
`.app-preferences-plugin`. These hooks identify the owning surface and item; native link
focus and shared component state remain authoritative.

The scroll viewport shows every filtered plugin without pagination. The status filter beside
Tags offers All plugins (default), Enabled and Disabled. It combines with search and tags,
uses the same inventory state as the switches, and updates when a plugin is toggled. Failed
plugins appear under Disabled, matching their retry switch. `pluginStatus` uses a typed nuqs
literal parser and survives detail/back navigation alongside search and tags. Legacy
pagination query parameters no longer limit the list. Linked rows
retain native keyboard focus and navigation but have no full-row hover background.
When no plugins match, the existing standard Empty component shows a search icon, a concise
title and localized guidance to adjust the search or filters. The existing filter controls
remain available above it.

The plugin overview consumes `useRuntimeInventory` for public metadata and declarations.
React icons remain presentation values outside the serializable snapshot. Installed packages
without a running instance are not synthesized into this runtime-only overview.
`bitakit add settings-page <plugin>` scaffolds a custom page retaining `renderField`; generated
navigation and body registration remain automatic.

Settings bodies and extension widgets use the UI package's standard per-contribution render
boundary. A failed custom/generated body identifies the page's plugin; siblings/navigation
remain usable. The retry fallback stays inside the existing page access boundary and disappears
when access is revoked. This does not change service startup policy or server authorization.

## Shared layouts and extension regions

Shell owns `brand`, `header.start/center/end`, `header.rows`, contextual `header.row.start/end`,
`content.before/after`, `footer`, `drawer.header/body/footer`, `navigation.group.before/after`
and optional `state.content/actions` under the `shell.` prefix. Existing `sidebar.header/footer`,
`sidebar.body`, `app-bar.end` and the Action slot `shell.navigation` remain explicit contracts.
`ShellSurface` is the shared base for `AppShell.Content` and `AppShell.FullPage`; named layouts
use the existing `src/layouts/` convention. `blank` remains bare. Render children once.

Use `AppShell.HeaderRow` with a unique row ID, `AppShell.NavigationGroup` with an explicit Action
slot, and `AppShell.Drawer` with a unique drawer ID. Contributions filter rowId/groupId/drawerId
through `when`; omitting it intentionally selects all occurrences. Radix Sheet retains focus
and modality; side is logical start/end, with explicit/inherited Radix direction.

`PageState`/error helpers accept `content` for composition and optional `surfaceId` for keyed
message/list recovery regions. Core is never required for host-owned fallback/retry. Optional
regions are guarded against missing/stopped runtimes and client render failures. This does not
catch SSR or arbitrary asynchronous errors. Essential recovery stays outside failing plugins.

App Preferences additionally owns `navigation.header`, `navigation.group.before/after` with
`groupId`, and `page.header/before/footer` with `pageId`. Page regions remain inside the existing
page access boundary. Navigation-shell regions are not protected by an individual page boundary.
No second Settings catalog, store, route registry or layout engine is introduced.

Progressive examples and the full region table: `apps/docs/content/docs/reference/layouts.mdx`.

### Session plugin controls

Each installed row binds the host-owned `runtime.plugins.change` Action through the standard
Switch. Core previews the operation and checks it again after confirmation. Disable confirms
all affected dependent/owned plugins; it never silently cascades or uninstalls code. Re-enable
providers before their consumers. Disabled definitions and their settings remain available.
These controls change only this runtime session; reloading restores host configuration and
service-local memory may reset on reactivation.

App Preferences and Shell are preserved. Core additionally blocks identity/storage/provider
and other compositions that require restart. A disabled control exposes its translated reason
through a keyboard-focusable tooltip. Pending work disables conflicting operations. Failed
startup permits retry; failed cleanup requires resource recovery and a fresh runtime. The
management page remains reachable inside its existing boundary if its catalog projection was
stopped by an unsuccessful update; other settings pages keep normal owner availability rules.
