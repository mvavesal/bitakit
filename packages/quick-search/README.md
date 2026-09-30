# Quick Search

Install `@bitakit/quick-search` as a direct app dependency. Foundation package discovery registers its dialog Action and `app-bar.end` view automatically; the standard AppBar displays the search button in either Shell layout. No app component, provider or per-action registration is required. The package entry imports its styles using the host's central theme tokens.

The plugin uses Core, generic Foundation React bindings and standard UI primitives, cmdk, React and Reicon. It does not import Shell, Settings or Better Auth. A custom application header can render the same `PluginSlot` named `app-bar.end`, or render `QuickSearchTrigger` explicitly. Without an AppBar the default Mod+K shortcut still opens the dialog.

The trigger is a button styled as a compact search field. Clicking it opens Foundation's existing dialog and focuses the real search input. Cmdk provides filtering, ranking and arrow/Enter selection. Escape closes the dialog. Search includes current public, visible, safe URL Actions only; command/form/dialog Actions and internal helpers are excluded. Disabled and pending destinations cannot be selected. Results use real ActionLink anchors, preserving native modified-click/new-tab behavior without also executing the Action handler.

Title, description, icon and platform-formatted shortcut come from current resolved snapshots. Existing Action groups supply headings and search keywords. Each Action appears once under its first group. There is no invented category schema, copied registry or persistent search state.

For manual configuration, use `quickSearchPlugin({ title, placeholder, empty, shortcut })`; set `shortcut: false` to disable it. Defaults are German and Mod+K. Standard package discovery requires the Foundation host; installing the package cannot add a header to arbitrary React applications.

Run the focused check with `npm test --workspace @bitakit/quick-search`.

### Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as
`./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration
with `mergePluginMessages`; app catalogs override matching keys in the same locale.
