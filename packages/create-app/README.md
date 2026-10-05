# @bitakit/create-app

Create a BitaKit app with **Next.js** or **TanStack Start** (experimental), or a standalone plugin package.

## 1. Create a minimal app

With a matching published package set:

```sh
npx @bitakit/create-app@0.2 my-app --framework next --features none --yes
cd my-app
npm run dev
```

For unpublished source changes, use the [local package workflow](../../apps/docs/content/docs/local-development.mdx).
Open the printed address: BitaKit is already connected.

## 2. Add one page

Create `src/plugins/counter/ui/pages/index.tsx`:

```tsx
'use client';
import { PageHeader } from '@bitakit/ui/components';
export default function CounterPage() {
  return <PageHeader title="Counter" />;
}
```

Visit `/counter`. Then follow the [Counter lessons](../../apps/docs/content/docs/concepts/index.mdx)
to add a service, an Action, a slot and Settings one step at a time.

## 3. Choose extras later

Run `npx @bitakit/create-app my-app` for interactive choices. The flags below are reference;
the minimal app above needs no additional options.

## Options

| Option                       | What it does                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `--framework next\|tanstack` | The framework. Default: `next`. TanStack Start is experimental.                                   |
| `--features <list>`          | Comma-separated `preferences`, `shell`, `quick-search`, or `none`. Default: `shell,quick-search`. |
| `--sample` / `--no-sample`   | Add the Todos sample plugin in `src/plugins/todos`. Asked interactively; off with `--yes`.        |
| `--plugin`                   | Create a standalone plugin package with a playground app instead of an app.                       |
| `-y, --yes`                  | Use the defaults without prompts.                                                                 |
| `--no-install`               | Write the files without installing dependencies.                                                  |
| `--dry-run`                  | Print the resolved plan without writing anything.                                                 |

Features bring their prerequisites: Shell adds App Preferences, and Quick Search adds Shell. The generator never overwrites an existing directory. If installing fails, the generated files stay for inspection and the command exits with an error.

## What you get

- The official framework project (`create-next-app` or the blank TanStack Start template), with your pages and routes as ordinary framework files.
- Build-time discovery (`withBitaKit` in `next.config.ts`, or the `bitakit()` Vite plugin) and `<BitaKitProvider>` from the generated `src/bitakit.gen.tsx` in the root layout: files in `src/plugins/<name>/` become plugins without a registry.
- A catch-all route that renders plugin pages, and the generated package stylesheet `src/bitakit.gen.css` imported once. `src/bitakit.gen.*` is ignored by Git.
- With Shell: the application layout, the theme script in the root layout, settings pages and `src/configs/shell.ts`. In Next.js, your home page is then `src/app/(app)/page.tsx`.
- `README.md` and `AGENTS.md` for your project, and the `bitakit` command (`@bitakit/cli`, with `@bitakit/discovery` for `bitakit.config.ts`) as dev dependencies: `npx bitakit add plugin notes` adds a feature, `npx bitakit doctor` checks the project. In an existing app, `npx bitakit init` writes the same wiring.

The generator does not create a backend, authentication, a database or email; those are separate integrations.

## Plugin packages

```sh
npx @bitakit/create-app my-plugin --plugin
```

This creates a package with the same folders as a plugin inside an app (`src/services`, `src/actions`, `src/events.ts`, `src/ui/pages`), a headless test with `mountPlugin`, and a `playground/` app that discovers the plugin source with hot reload and shows the Inspector. `npm run dev` starts the playground, `npm test` runs the tests, `npm run typecheck` checks the types, and `npm run build` runs `bitakit build` to produce `dist/plugin.js`, the entry apps discover through `bitakit.plugin` in `package.json`.

## Contributing

Run `npm test --workspace @bitakit/create-app`. To try the generator against this repository's unpublished packages, pack them and pass the directory: `npm run pack -- <directory>` from the repository root, then `node packages/create-app/src/cli.mjs my-app --packages-dir <directory>`. `npm run verify:generated` generates every project shape from packed packages and checks install, types, build and a browser smoke test.
