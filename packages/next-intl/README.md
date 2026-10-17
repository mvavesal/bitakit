# @bitakit/next-intl

Optional next-intl integration. The package manifest declares `bitakit: { plugin: './plugin' }`,
so a generated app composes `nextIntlPlugin()` without host code; render the app inside the
host's `NextIntlClientProvider`. Its locale and messages stay authoritative: the plugin keeps no
second locale store. The host configures the request locale, supported languages and message
composition.

`nextIntlPlugin()` takes no arguments. It provides the `i18n` translation service
(`provides: translationService`: `translate`, `getCatalog`, `subscribe`) and the provider
`next-intl.messages` (`src/ui/providers/messages.tsx`). The provider reads `useTranslations()`
and `useMessages()` and publishes them into a small store the service reads. Services are
created when the runtime mounts, after the first render, so the store belongs to the plugin
instance, and the provider publishes in a layout effect: before the runtime mounts, and before
paint when the locale or the messages change. The store notifies only when the translator or
the messages changed. Until the first publish, `translate.has` is false and texts show their
literal fallbacks.

## Source responsibilities

- `src/plugin.ts` (`.`, `./plugin`): the package plugin, `nextIntlPlugin`.
- `src/messages.ts`: the translation service and its store, no React.
- `src/ui/providers/messages.tsx`: the provider that feeds next-intl into the store.
- `src/preferences.ts` (`./preferences`): optional `languagePreferences` composition of
  standard App Preferences definitions, catalog section and host persistence callbacks.
- `locales/en.json`, `locales/de.json`: this integration's own language-setting labels.

`languagePreferences({ locales, defaultLocale, category })` returns the setting, a normal
BitaKit plugin and `storage(base, { load, save, reset })`. Register the plugin beside
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
