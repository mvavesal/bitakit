# Custom layout: the app draws its own frame

A small team handbook whose frame is the app's own: one bar with the brand, the navigation and
the header widgets, then the page and a footer. Shell's sidebar is gone, yet every plugin that
fills a Shell slot still shows up. A plugin offers a second frame, and one line in
`bitakit.config.ts` switches to it.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Handbook**: the navigation sits in the top bar, next to the brand, Quick Search and
   the "v2.4" badge. "All systems normal" is in the footer.
2. Open a chapter and **Changelog**: every page gets the same frame without asking for it.
3. In `bitakit.config.ts`, uncomment `choose: { 'layout.app': 'classic' }` and reload: the
   classic plugin's sidebar frame takes over, with the same pages, badge and footer.
4. Run `npx bitakit slots`: `layout.app` lists two contributions and names the one that renders.

## How it fits together

| File                                            | Role                                                         |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `src/layouts/app.tsx`                           | The app's frame for `layout.app`, from hooks and Shell parts |
| `src/ui/slots/shell.brand.tsx`                  | The brand, rendered by both frames                           |
| `src/plugins/classic/ui/layouts/app.tsx`        | A plugin's frame for the same part                           |
| `bitakit.config.ts`                             | `choose` decides between the two                             |
| `src/plugins/status/ui/slots/shell.*.tsx`       | A header badge and a footer line, unaware of the frame       |
| `src/plugins/handbook`, `src/plugins/changelog` | Ordinary pages with navigation Actions                       |

The app's frame reads the navigation with `useNavigation()` and renders each entry with
`AppShell.NavigationItem`, so links, active state and icons match Shell's. `AppShell.Surface`
adds the standard page spacing and the `shell.content.before`/`.after` slots, and
`AppShell.Footer` the `shell.footer` slot. A frame that leaves out a slot hides what plugins
put there, so render every slot your plugins use.

The app's own file wins over a plugin's without any configuration; `choose` is needed only to
prefer a plugin, or when two plugins offer the same part. For frames of single pages
(`export const layout = 'auth'`) and replaced error screens, see the Layouts sample.
