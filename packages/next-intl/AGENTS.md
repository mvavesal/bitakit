# @bitakit/next-intl — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/next-intl`).
> To change the package itself, follow the repository's own AGENTS.md instead.

Connects next-intl to BitaKit: it provides the `i18n` translation service, so Action titles,
setting labels and plugin texts that are translation keys resolve through the app's next-intl
catalogs. It is a discovered plugin (`next-intl`) and keeps no locale store of its own.

## Use it

- Render the app inside the host's `NextIntlClientProvider`; the request configuration
  (`src/i18n/request.ts`) owns the locale, supported languages and catalogs.
- Merge each installed package's `./locales/<lang>.json` with `mergePluginMessages`, then pass
  the app's catalogs: for the same key, the app wins.
- Texts: an Action `title`, a setting `label` or a notification can be a translation key;
  `useTranslation()` from `@bitakit/ui` translates in React with a fallback.
- An interface-language setting comes from `languagePreferences({ locales, defaultLocale })` in
  `@bitakit/next-intl/preferences`: it returns the setting, a plugin to register beside App
  Preferences and a `storage(...)` wrapper that routes `language.locale` to the host's
  persistence (see the README). The language is then a normal select on the Settings page.

## Rules

- Keep the locale in the validated cookie the host already uses; no second locale store and no
  URL locale prefix without a product requirement.
- Keep matching keys in every language catalog; plugin text stays in its own package.
