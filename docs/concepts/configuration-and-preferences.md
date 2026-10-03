# Configuration and user preferences

Application configuration and user preferences answer different questions.

|                 | Application configuration                             | User preferences                                              |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Who chooses it? | The developer or deployment.                          | The user, within options the app exposes.                     |
| Example         | Plugin defaults and selected capabilities.            | Theme or language.                                            |
| Owner           | `defineConfig` files and `bitakit.config.ts`.         | `defineSettings` in `settings.ts`; the Core runtime owns the values. |
| UI              | No settings screen is created by configuration alone. | App Preferences generates a page per plugin under `/settings`. |

## Application configuration

A plugin defines defaults in `configs/<name>.ts` with `defineConfig({ defaults, schema })`
and reads them as `config.plugin.get(path, fallback)` or `app.config.<plugin>.<name>`. The
host overrides them in `bitakit.config.ts` under `configOverrides`. The result is an
immutable snapshot resolved before services start; optional schemas validate it. A plugin
reads its resolved configuration instead of inventing a second configuration store.

Configuration is not a place to expose server secrets to client code. Provider
credentials stay in the server's configuration and its appropriate integration.

## User preferences

A plugin declares its settings once in `settings.ts` with `defineSettings({ name: setting({ default, schema?, scope? }) })`.
Keys are `<plugin>.<name>`; every service and action reads and writes them through typed
handles (`settings.todos.pageSize.get()`, `set()`, `subscribe()`), React through `useSetting`.
The Core runtime owns the confirmed values, follows the `auth` contract for the user and
organization identity and persists through the `settings.storage` contract: browser storage
by default, or one host service with `provides: settingsStorage`. App Preferences renders a
generated page per plugin; `ui/settings/page.tsx` replaces it. Core itself renders nothing.

"Out of the box" depends on what the application installs and configures. The selected
framework provider and optional visual packages compose supported defaults; installing
Core alone does not create settings pages, a database, or persistent user accounts.
Server-backed persistence is a storage service that re-reads the trusted `settings.ts` files
on the server and applies its own access rules; a client declaration grants no persistence.

Start with [App Preferences](../../packages/app-preferences/README.md),
[the package map](../../packages/README.md), or
[Core configuration conventions](../../packages/core/docs/file-contributions.md).
