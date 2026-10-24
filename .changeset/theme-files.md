---
'@bitakit/shell': patch
---

Themes can be shared as JSON files. The Themes page has **Download theme** and **Import theme**
buttons: a download saves the theme shown in the preview as `<name>.theme.json`, and an import
opens the file as an unsaved personal copy with a new ID that **Save copy and apply** saves.
Imported files may set only known theme tokens, and values that load resources (`url()`, image
functions) or contain CSS escapes, `;`, braces, `<`, `>` or `@` are rejected. New exports:
`parseThemeFile`, `stringifyThemeFile`, `themeFileSchema`, `themeFileSchemaUrl`, and the JSON
Schema at `@bitakit/shell/theme.schema.json` that downloaded files reference in `$schema`.
Source themes (`src/themes/*.json`, the `themes` option) accept and ignore `$schema`, so a
downloaded file can be copied into the app unchanged.
