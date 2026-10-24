# Gallery

A theme preview on `/gallery` that switches the app themes from `src/themes/`.

## Public contracts

- `gallery.open` links to `/gallery` in `shell.navigation`.
- The page binds Shell's `shell.selectTheme` with `{ key: 'app:ocean' }` and
  `{ key: 'app:sunset' }`; it owns no themes or settings itself.

## Constraints and checks

Theme files live in `src/themes/`, not in this plugin. From the app root run
`npm run typecheck` and `npx bitakit doctor`; on `/gallery`, switch themes and reload.
