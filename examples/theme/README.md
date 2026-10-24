# Theme: your own look

Two app themes as JSON files and a gallery page whose buttons switch between them with
Shell's own Action. No CSS overrides, no provider.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Theme gallery** and press **Use Sunset**: colors, corners and the font change
   everywhere. Reload: the choice stays.
2. Press **Use Ocean**.
3. Open **Customize in Settings** to switch light and dark, or to save a personal copy.

## What to look at

| File                                     | Role                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| `src/themes/ocean.json`                  | A small theme: only the primary color pair and the radius  |
| `src/themes/sunset.json`                 | A fuller theme: surfaces, borders, radius and a serif font |
| `src/plugins/gallery/ui/pages/index.tsx` | Binds `shell.selectTheme` with `{ key: 'app:<id>' }`       |

Guide: [Themes and appearance](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/concepts/theming.mdx).
