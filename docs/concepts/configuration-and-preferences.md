# Configuration and user preferences

Application configuration and user preferences answer different questions.

|                 | Application configuration                             | User preferences                                              |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Who chooses it? | The developer or deployment.                          | The user, within options the app exposes.                     |
| Example         | Plugin defaults and selected capabilities.            | Theme or language.                                            |
| Owner           | Core configuration contracts and host composition.    | The separate App Preferences package.                         |
| UI              | No settings screen is created by configuration alone. | Catalog sections and controls can expose registered settings. |

## Application configuration

Core provides configuration definitions, defaults, scopes, and host overrides. A
plugin reads its resolved configuration instead of inventing a second configuration
store. Optional schemas can validate configuration through their declared contract.

Configuration is not a place to expose server secrets to client code. Provider
credentials stay in the server's configuration and its appropriate integration.

## User preferences

App Preferences owns registered preference values and their configured persistence.
Its settings catalog describes sections and fields. Optional feature plugins can
contribute settings to that catalog rather than each building an unrelated settings
system. Core itself does not implement a settings UI.

“Out of the box” depends on what the application installs and configures. The selected
framework provider and optional visual packages compose supported defaults; installing
Core alone does not create settings pages, a database, or persistent user accounts.
Server-backed persistence requires server-side registration and access controls as well
as the visible field.

Start with [App Preferences](../../packages/app-preferences/README.md),
[the package map](../../packages/README.md), or
[Core configuration conventions](../../packages/core/docs/file-contributions.md).
