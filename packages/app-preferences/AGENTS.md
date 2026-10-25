# @bitakit/app-preferences — guide for agents

> For agents building an app with this package (it ships in
> `node_modules/@bitakit/app-preferences`). To change the package itself, follow the
> repository's own AGENTS.md instead.

App Preferences is the Settings UI. Every `settings.ts` of a plugin (or the app) gets a
generated page under `/settings/<plugin>` with a navigation entry, search and the standard
controls. It is a discovered plugin with the ID `app-preferences`; create-app installs it.

## Setup an app already has

- `src/app/settings/[[...section]]/page.tsx` renders `<SettingsRoute />` (TanStack: a
  `settings.$` route). Mount it once; do not write settings shells or navigation.
- Values live in Core's settings store and the `settings.storage` contract (browser storage by
  default). To save on a server, add one app service with `provides: settingsStorage`; see the
  README "Persist settings on a server". `settings.ts` files stay unchanged.

## Add a setting (the usual task)

```ts
// src/plugins/todos/settings.ts
import { defineSettings, setting } from '@bitakit/core';

export default defineSettings(
  { pageSize: setting({ default: 20, label: 'Items per page' }) },
  { title: 'Todos', category: 'general' },
);
```

`/settings/todos` now shows a number field. Read it with `useSetting('todos.pageSize')` in React
and `settings.todos.pageSize.get()` in services and Actions. Controls follow `control` or the
value: boolean → switch, `options` → select, number → number, string → text; `radio`, `cards`
and `textarea` are explicit.

## Customize a page

- `src/plugins/<id>/ui/settings/page.tsx` replaces the generated body and keeps the URL and
  navigation. It receives `{ section, renderField }`; reuse `SettingsFields` and
  `<SettingField settingKey="todos.layout" />` to keep the standard control, saving state,
  inline error and reset.
- `npx bitakit add settings-page todos` scaffolds it.
- `hidden: true` keeps a setting off the pages; it still works in code.

## Extend the Settings UI (slots)

| Slot                                                  | Accepts   | Where                                                  |
| ----------------------------------------------------- | --------- | ------------------------------------------------------ |
| `app-preferences.page.after`                          | component | Below a page; payload `{ pageId }`, filter with `when` |
| `app-preferences.page.toolbar`                        | Actions   | Page toolbar; `{ pageId }` maps to the Action input    |
| `app-preferences.navigation`                          | Actions   | An extra destination in the settings sidebar           |
| `app-preferences.navigation.footer`                   | component | Below the settings sidebar                             |
| `app-preferences.page.header` / `.before` / `.footer` | component | Around every settings page                             |

The `app-preferences.page.body` slot is keyed and maintained by the plugin; replace a page with
`ui/settings/page.tsx`, not by contributing to it.

## Link to a setting

`app-preferences.settings` is a typed navigation Action with no input. Bind it with
`ActionLink` when the host places Settings in its own footer/header. Configure the plugin
with `slots: []` to omit its default Shell navigation placement; do not create another Action.
In a discovered app, pass the configured `appPreferencesPlugin` through the provider's
`additionalPlugins` to replace the discovered instance with the same ID.

`settingHref('/settings', { path: 'theme' }, 'shell.mode')` gives
`/settings/theme#setting-shell.mode`; opening it scrolls to, focuses and highlights that field.
`sectionHref` links to a page. Use these for help texts, search results or onboarding.

## Rules

- Declare preferences with `defineSettings` only; no own settings store, form or page registry.
- Read settings when you use them (`.get()` in methods), not in a service factory body.
- Settings are UI preferences, not permissions; a server storage service decides writability.

## More

README sections: Use it, Replace a generated page, Settings extension slots, Persist settings
on a server, API, Linking to a setting.
