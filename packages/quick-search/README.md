# Quick Search

A BitaKit search dialog with plugin-owned sources, navigation results, source preferences and
recent history. Open it with Mod+K or the AppBar search button.

```sh
npm install @bitakit/quick-search
```

Package discovery registers the plugin, typed `quick-search.sources` data slot, translations
and theme-based stylesheet. Pages, Settings and plugin destinations are included by default.
Plugin contributions can search their own data without editing Quick Search or host wiring.
The complete guide is in the repository's `apps/docs/content/docs/reference/quick-search.mdx`.

## Add a source

From your plugin's `setup.ts`, attach a `SearchSource` (type import from
`@bitakit/quick-search/sources`) to `quick-search.sources`, using an explicit stable local `id`.
The source supplies `title`, `description`, `category: { id, title }`, `defaultEnabled`,
`search({ query, signal })` and `resolve(id, context)`. Preserve the returned attachment's
cleanup handle. Core qualifies the ID with the owner, for example `catalog:lessons`.
The complete, typed local example is included in `examples/catalog`.

Results are safe links (`{ id, title, href, description? }`) or live Action references
(`{ id, actionId }`). Sources filter/rank their own arrays; local sources can use the supplied
`score(title, keywords)` cmdk matcher. Source-owned text accepts literals/translation keys or
`{ key, fallback }`. Existing Action titles and guards remain owned by ActionList.

Enabled sources run concurrently and publish independently. Changes to the query, filters,
preferences, identity or lifecycle abort and invalidate stale work. Removed/disabled sources
are not searched. Source/backend authorization is required; a visible or remembered result
never grants access. Commands and dialogs remain excluded.

## Preferences and history

**Search sources** in the dialog and `/settings/quick-search` in App Preferences share the
runtime's user setting `quick-search.sources`. Saved overrides win; new sources use their own
defaults. Category filters are temporary for the current dialog.

Opening a result records its ID and query. Empty search shows recent queries and destinations
freshly resolved through their source. `quick-search.historyEnabled` disables recording/display;
**Clear history** removes stored queries/references. History retains up to 20 of each per user
and displays only the current organization's entries. It stores no cached titles or URLs.
The existing `settings.storage` and auth contracts own persistence and identity. Trusted server
adapters can import `quickSearchSettings` from `@bitakit/quick-search/settings`.

Existing `QuickSearchOptions` remain supported: `title`, `placeholder`, `empty`, `shortcut`
and `results: { pages, settings, plugins }`. Result switches now provide initial source defaults;
saved user choices take precedence. Pages, Settings and plugins default to enabled.
Duplicate destinations collapse, shortcuts remain visible, and native modified clicks/Mod+Enter
open new tabs. Hidden/internal/unsafe results are excluded and disabled Actions remain guarded.

Without discovery, compose `quickSearchPlugin(options)`, the host's root stylesheet and, for
Settings/plugin destinations, `appPreferencesPlugin()` and its Settings route. A custom header
can render `QuickSearchTrigger` or the `app-bar.end` slot; installing a package cannot create a
header in an arbitrary host. Compose `locales/en.json` and `locales/de.json` with the host catalogs.

## External component CSS

The central theme supplies the default appearance. For deliberate application-specific
adjustments, import ordinary CSS after the generated root styles. These existing/public
entry points belong to Quick Search:

| Class                                             | Purpose and existing states                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `.quick-search-trigger`                           | AppBar button; native hover/focus and `aria-haspopup="dialog"`                      |
| `.quick-search`                                   | Command content inside the host's portaled dialog                                   |
| `.quick-search-controls`                          | Category and persistent-source controls; disclosure uses `aria-expanded`            |
| `.quick-search-category-menu`                     | Portaled category popup; Radix `data-state`, items use `aria-checked`               |
| `.quick-search-list`                              | Results or source-selection scroll area; the result list uses `aria-busy`           |
| `.quick-search-item`, `.quick-search-link`        | Result row/native link; cmdk `data-selected` and `data-disabled`                    |
| `.quick-search-sources`, `.quick-search-settings` | Shared source switches and Settings content; switches use `aria-checked`/`disabled` |

For example, a developer may deliberately remove just the trigger's depth while retaining
its button semantics, size and focus treatment:

```css
.quick-search-trigger {
  box-shadow: none;
}
.quick-search-trigger:hover {
  background: var(--muted);
}
.quick-search-category-menu[data-state='open'] {
  font-style: normal;
}
```

The category menu is portaled: target its class directly, not as a descendant of the trigger.
Reuse native focus/hover and the listed attributes instead of adding parallel state classes.
These selectors describe important parts, not a guaranteed class for every internal wrapper.

## Source map and verification

- `slots.ts`, `types.ts`, `schemas.ts`: headless source contract.
- `destination-sources.ts`: existing navigation as ordinary sources.
- `service.ts`: concurrent requests, cancellation and serialized history operations.
- `settings.ts`: the single preference/history declaration.
- `ui/`: dialog, native result links and shared source controls/settings content.

Run `npm test --workspace @bitakit/quick-search`. The repository's
`node scripts/verify-generated.mjs --only next-search --keep` checks the shipped example in a
packed Next.js host in development and production, including Settings, history and responsive UI.
