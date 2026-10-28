# Language

The interface language as a setting. This folder only hands the setting declared by
`@bitakit/next-intl/preferences` (see `src/i18n/language.ts`) to discovery.

## Public contracts

- `settings.ts`: `language.locale` (`en` or `de`), shown on Settings → Language as a select.
  `src/services/settings-storage.ts` saves it in the `locale` cookie that
  `src/i18n/request.ts` reads.

## Checks

Choosing Deutsch translates Settings at once; a reload keeps German.
