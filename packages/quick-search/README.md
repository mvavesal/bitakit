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

Check the installed package's `./sources` declarations and `bitakit slots --json` before using
the source contract; older versions only enumerate navigation Actions. The shipped
[setup example](examples/catalog/setup.ts) includes the optional-integration availability guard
and attachment cleanup.

From your plugin's `setup.ts`, attach a `SearchSource` (type import from
`@bitakit/quick-search/sources`) to `quick-search.sources`, using an explicit stable local `id`.
The source supplies `title`, `description`, an optional component `icon`, `category: { id, title }`, `defaultEnabled`,
`search({ query, signal })` and `resolve(id, context)`. Preserve the returned attachment's
cleanup handle. Core qualifies the ID with the owner, for example `catalog:lessons`.
The complete, typed local example is included in `examples/catalog`. Icons use Core’s existing
opaque presentation type; React hosts supply a component, with Reicon Search as the default.

Results are safe links (`{ id, title, href, description? }`) or live Action references
(`{ id, actionId }`). Sources filter/rank their own arrays; local sources can use the supplied
`score(title, keywords)` cmdk matcher. Source-owned text accepts literals/translation keys or
`{ key, fallback }`. Existing Action titles and guards remain owned by ActionList.

Enabled sources run concurrently and publish independently. Changes to the query, filters,
preferences, identity or lifecycle abort and invalidate stale work. Removed/disabled sources
are not searched. Source/backend authorization is required; a visible or remembered result
never grants access. Commands and dialogs remain excluded.

## Preferences and history

The dialog shows one compact **All categories** dropdown below the search input. Category
selection narrows enabled sources for this dialog only and resets when the dialog reopens.
Permanent source choices live at `/settings/quick-search`: each row shows its icon, title and
description with a Switch on the right. They edit the runtime's user setting `quick-search.sources`.
Saved overrides win; new sources use their own defaults.

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

| Class                                             | Purpose and existing states                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `.quick-search-trigger`                           | AppBar button with the central input surface and Search icon; native focus and `aria-haspopup="dialog"` |
| `.quick-search`                                   | Command content inside the host's portaled dialog                                                       |
| `.quick-search-controls`                          | Compact category filter row; trigger uses `aria-expanded`                                               |
| `.quick-search-category-menu`                     | Portaled category popup; Radix `data-state`, items use `aria-checked`                                   |
| `.quick-search-list`                              | Result scroll area; uses `aria-busy`                                                                    |
| `.quick-search-item`, `.quick-search-link`        | Result row/native link; cmdk `data-selected` and `data-disabled`                                        |
| `.quick-search-sources`, `.quick-search-settings` | Settings source rows and content; switches use `aria-checked` and `disabled`                            |

The trigger composes the central Button's dimensions and keyboard behavior with the central
input surface (`data-slot="input"`, medium round radius and input border). It keeps native
button semantics, a muted placeholder-style label and the existing keyboard-hint keycap with
its platform-aware shortcut; typing starts in the dialog after opening it.

The category menu is portaled: target its class directly, not as a descendant of the trigger.
Reuse native focus/hover and the listed attributes instead of adding parallel state classes.
These selectors describe important parts, not a guaranteed class for every internal wrapper.

## Source map and verification

- `slots.ts`, `types.ts`, `schemas.ts`: headless source contract.
- `destination-sources.ts`: existing navigation as ordinary sources.
- `service.ts`: concurrent requests, cancellation and serialized history operations.
- `settings.ts`: the single preference/history declaration.
- `ui/`: dialog, native result links and Settings source controls.

The renderer compares semantic navigation fields before rerunning a search: service result
publications also refresh Actions, and a raw Action revision would restart the same request.
The package's `styles.css` declares `@source './dist'` so installed consumers receive its layout
utilities; workspace CSS discovery must not conceal a missing source declaration.

When adding a source, typecheck the contributing plugin, run `bitakit doctor`, then check its
Settings switches, temporary categories, slow/failed requests, history restoration, plugin
removal and identity changes in the app. The local `examples/catalog` fixture needs no domain
backend. The repository's `apps/todo-preview` demonstrates real tasks through the existing
authorized Todo service; its own README documents that preview's setup and checks.

Run `npm test --workspace @bitakit/quick-search`. The repository's
`node scripts/verify-generated.mjs --only next-search --keep` checks the shipped example in a
packed Next.js host in development and production, including Settings, history and responsive UI.
