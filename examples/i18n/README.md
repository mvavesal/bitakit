# i18n: two languages, one switch

A task list in English and German. The language is an ordinary setting, saved in a cookie;
switching it translates the page, the buttons, the messages, Settings and Shell without a
reload and without losing what is on the screen. Each plugin brings its own catalogs.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Tasks** and add one: the message, the counter ("1 task left") and the time are
   English.
2. Settings → Language → **Deutsch**. Settings itself switches at once.
3. Back on **Aufgaben**: your task is still there, with its title as you typed it. Everything
   around it is German, including "1 Aufgabe offen" and the time in 24-hour format.
4. Reload: the server renders German right away, because the choice is in a cookie.

## Where the texts come from

| Text                                         | Catalog                                               | Read with                       |
| -------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| Start page                                   | `locales/en.json`, `locales/de.json` (the app)        | `useTranslations('home')`       |
| The tasks page                               | `src/plugins/tasks/locales/*.json` under `tasks.page` | `useTranslations('tasks.page')` |
| Action titles                                | the same files: `tasks.<file>.title`                  | automatic                       |
| Action messages                              | `tasks.<file>.success`, with `values` from the Action | automatic                       |
| Setting labels and the section title         | `tasks.settings.title`, `tasks.settings.<name>.label` | automatic                       |
| Shell, Settings, Quick Search, `@bitakit/ui` | each package's own `locales/*.json`                   | automatic                       |

The text in an Action or a setting is the English fallback; a catalog key with the same
place wins. Discovery collects `src/plugins/<id>/locales/<lang>.json` into
`src/bitakit.gen.messages.json`; a catalog may only use its plugin's namespace.

## How the language is wired

| File                               | Job                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `src/i18n/config.ts`               | The languages, the default and the cookie name                              |
| `src/i18n/request.ts`              | Reads the cookie and merges package, plugin and app catalogs                |
| `src/app/layout.tsx`               | `NextIntlClientProvider` around the generated `BitaKitProvider`             |
| `src/i18n/language.ts`             | The language setting from `@bitakit/next-intl/preferences`                  |
| `src/plugins/language/settings.ts` | Hands that setting to discovery: Settings → Language                        |
| `src/services/settings-storage.ts` | Saves `language.locale` through the server actions in `src/i18n/actions.ts` |
| `next.config.ts`                   | next-intl's plugin inside `withBitaKit`                                     |

`@bitakit/next-intl` is installed like any BitaKit package: discovery adds its plugin, which
gives Actions, settings and notifications the same messages as next-intl. The page uses
next-intl's hooks directly, so the server renders the chosen language from the first byte.

To add a language, add it to `src/i18n/config.ts`, add `locales/<lang>.json` to the app and to
each plugin, and import the packages' catalogs for it in `src/i18n/request.ts`.
