# Quick Search

A search dialog for BitaKit apps: press Mod+K, or click the search button in the app bar, to jump to a page, a settings page or a plugin.

## Install

```sh
npm install @bitakit/quick-search
```

That is all. Foundation package discovery registers the search Action and the `app-bar.end` view automatically; the standard AppBar shows the search button in either Shell layout. You do not register results, add a provider or write a component. Discovery includes the package's declared stylesheet in the root generated CSS; it uses the host's theme tokens and has no JavaScript CSS side effects.

## What search finds

Search finds places to go, nothing else. Each result is a link and shows its type and, unless the app itself owns it, the plugin it belongs to: `Tasks — Page · Todos`, `Notifications — Settings · Todos`. Typing a plugin's name finds everything that plugin owns.

| Type     | What it includes                                                      | Default |
| -------- | --------------------------------------------------------------------- | ------- |
| Pages    | Links to pages of the app, and other navigation links                 | on      |
| Settings | Pages of the Settings catalog                                         | on      |
| Plugins  | One result per plugin, opening its entry on the Plugins settings page | on      |

Commands, dialogs and forms (Actions without a URL) never appear, so search never runs an Action. Hidden Actions and internal helpers never appear either, and disabled or pending links cannot be selected.

## Choose result types

Without configuration, search shows pages, settings and plugins. To change that, add `src/configs/quick-search.ts` to your app:

```ts
import { defineConfig } from '@bitakit/core';
import type { QuickSearchOptions } from '@bitakit/quick-search';

export default defineConfig({
  defaults: {
    results: { plugins: false },
  } satisfies QuickSearchOptions,
});
```

Each switch only affects its own type: turning plugin results off never hides a plugin's pages or settings, and turning settings off keeps pages. The same file accepts `title`, `placeholder`, `empty` and `shortcut` (`false` disables Mod+K).

Plugin results need App Preferences, whose Plugins settings page publishes one link per plugin (`settings.plugins.<id>`, `/settings/plugins?plugin=<id>`). Without that package no plugin results exist.

## How results are built

Results are the current, visible URL Actions of the app's single ActionList; there is no second search registry and no stored search state. Each result is a real link (`ActionLink`), so modified clicks still open new tabs, Mod+Enter opens the selected result in a new tab, and unsafe URLs are never shown. When several Actions lead to the same place, search shows one result: it prefers the one with a keyboard shortcut and keeps the most specific type. Action groups supply the headings and extra keywords. Results appear and disappear with their plugins.

Types and owners come from existing registrations through `runtime.destinationOf(action)`. A settings page belongs to the plugin that contributed its section. Another path of the app is a page of the plugin whose page path matches, otherwise of the plugin that contributed the link. External links have no type. Integrations that project their own registrations into the ActionList, such as App Preferences' settings pages and plugin entries, mark them with `destinationMetadata({ kind, plugin })`; developers never declare destinations.

## Without package discovery

In a host without Foundation discovery, add the plugin yourself: `quickSearchPlugin({ title, placeholder, empty, shortcut, results })`. A custom header can render the `PluginSlot` named `app-bar.end`, or `QuickSearchTrigger` directly. Without any header, Mod+K still opens the dialog. Installing the package cannot add a header to an arbitrary React app.

Such a host also owns its stylesheet entry: establish the canonical layer order, then import
`@bitakit/quick-search/styles.css` there. Generated BitaKit apps do this automatically.

## Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as `./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration with `mergePluginMessages`; app catalogs override matching keys in the same locale.

Run the focused check with `npm test --workspace @bitakit/quick-search`.
