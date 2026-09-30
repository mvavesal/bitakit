# Localization

The foundation uses next-intl without locale-based routing. Translation catalogs are in `apps/web/locales/en.json` and `apps/web/locales/de.json`, grouped by feature. English is the default. Settings → Language offers English and Deutsch.

A validated, HttpOnly browser cookie persists the explicit choice for one year. The request configuration loads only an allowlisted dictionary. Unknown cookie values fall back to English. No session, organization, or account data determines the UI language.

`locale.set` is the shared parameterized action. It validates the input and calls a server action, which validates again and saves the cookie. Next.js refreshes the server-rendered UI while preserving mounted client state and intercepted Settings. Root HTML language follows the selection. No translated URL paths, locale prefixes, or duplicate locale store are introduced.

Translated foundation surfaces currently include settings, appearance controls, navigation contributions, sign-in/registration, and organization management. Historical Course Studio sample content and developer Action Demo examples remain in their original language. User-entered content and organization names are never automatically translated.

Use `useTranslations` in client components and `getTranslations` in async server components. Use next-intl formatters for future dates/numbers, with explicit appropriate time zones; the default time zone is UTC, not a guess based on language.

To add a regional variant such as `en-US` or `de-AT`, add its full catalog, register the exact BCP 47 identifier in `src/i18n/config.ts` and the explicit loader map in `request.ts`, and add its native label to the Language settings choices. Do not construct imports from unvalidated input. Keep catalog keys aligned; browser tests verify current catalog parity, persistence, fallback, server-page translation, and preservation of unsaved workspace state.

Reference: https://next-intl.dev/docs/getting-started/app-router
