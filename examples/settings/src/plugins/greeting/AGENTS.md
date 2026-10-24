# Greeting

A greeting on `/greeting` whose words, language and size come from settings.

## Public contracts

- Settings `greeting.name` (text), `greeting.formal` (switch), `greeting.language` (`en`,
  `de`, `es`) and `greeting.size` (`small`, `medium`, `large`); App Preferences renders them at
  `/settings/greeting` with the body from `ui/settings/page.tsx`.
- `greeting.reset` resets all four settings; `greeting.open` links to `/greeting`.
- The page also reads the app-wide setting `companyName` from `src/settings.ts`.

## Constraints and checks

Values are saved in browser storage per browser. From the app root run `npm run typecheck`
and `npx bitakit doctor`; change a setting, reload `/greeting` and see it kept, then reset.
