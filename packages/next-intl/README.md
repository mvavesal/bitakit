# @bitakit/next-intl

Optional next-intl integration. Call `useNextIntlPlugin()` inside the configured
`NextIntlClientProvider` and register the returned plugin with Foundation. The adapter
updates the existing translation service; it does not maintain a second locale store.
The host configures request locale, supported languages and message composition.

## Source responsibilities

- `src/index.ts`: reactive translator and raw `getCatalog(namespace?)` integration.
- `src/preferences.ts` (`./preferences`): optional `languagePreferences` composition of
  standard App Preferences definitions, catalog section and host persistence callbacks.
- `locales/en.json`, `locales/de.json`: this integration's own language-setting labels.

`languagePreferences({ locales, defaultLocale, category })` returns the setting, a normal
Foundation plugin and `storage(base, { load, save, reset })`. Register the plugin beside
App Preferences and use that storage when creating its instance. Only `language.locale`
is routed to the supplied persistence; other preferences retain their original storage.
Use a base storage with reset support to remove the locale override on reset.
Configured locales become standard Select options; labels may include flags. No separate
language buttons, locale state store or custom control are needed.

Content Demo persists through server actions and its validated HTTP-only locale cookie.
Next updates the existing provider tree after cookie mutation. Adding a language means
adding a configured option and an app catalog; missing plugin keys use the fallback catalog.

## Catalog ownership and overrides

Import each installed package's `./locales/en.json` and `./locales/de.json` in request
configuration. Compose them with the existing `mergePluginMessages`, then pass host
catalogs as `app`. For the same locale and key, the app wins. Plugin text stays in its
own package; the host contains only product text or deliberate overrides. Better Auth
uses its published upstream locale bundles through the existing native provider.

The translation service exposes `getCatalog(namespace?)` alongside `translate`. It
returns the current nested group, the full catalog without a namespace, or `undefined`
for missing/non-object groups. Updates notify the existing subscribers.
