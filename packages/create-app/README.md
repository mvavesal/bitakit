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

### With pnpm, Yarn or Bun

The generator installs with the package manager that started it, and the generated README
uses its commands:

```sh
pnpm create @bitakit/app my-app --framework next --features none --yes
yarn create @bitakit/app my-app --framework next --features none --yes
bunx @bitakit/create-app@latest my-app --framework next --features none --yes
```

`--package-manager <npm|pnpm|yarn|bun>` chooses one explicitly. A plugin package (`--plugin`)
is an npm workspace and always uses npm.

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

| Option                       | What it does                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--framework next\|tanstack` | The framework. Default: `next`. TanStack Start is experimental.                                                               |
| `--features <list>`          | Comma-separated `preferences`, `shell`, `quick-search`, or `none`. Default: `shell,quick-search`.                             |
| `--sample` / `--no-sample`   | Add the Todo sample: `src/plugins/todos` and `src/plugins/activity`, which extends it. Asked interactively; off with `--yes`. |
| `--plugin`                   | Create a standalone plugin package with a playground app instead of an app.                                                   |
| `-y, --yes`                  | Use the defaults without prompts.                                                                                             |
| `--no-install`               | Write the files without installing dependencies.                                                                              |
| `--package-manager <name>`   | `npm`, `pnpm`, `yarn` or `bun`. Default: the package manager that started the generator, else npm.                            |
| `--dry-run`                  | Print the resolved plan without writing anything, including whether it uses an existing folder.                               |

Features bring their prerequisites: Shell adds App Preferences, and Quick Search adds Shell. The generator never overwrites an existing project or file. If installing fails, the generated files stay for inspection and the command exits with an error.

## Create in the folder you already have open

```sh
npx @bitakit/create-app . --yes
```

A coding agent such as Codex or Claude Code opens a folder first. Pass `.` (or any existing folder) to create the app there, so its `AGENTS.md` and skill land in the folder the session works in. The folder may hold only `.git`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.DS_Store`, `Thumbs.db`, `.idea`, `.vscode`, `.agents`, `.claude`, `.codex`, `.cursor`, `AGENTS.md`, `CLAUDE.md`, `LICENSE` and `skills-lock.json`; anything else, such as a `package.json`, stops the command with a list of the unexpected entries. The package name comes from the folder name.

The project is generated in a temporary folder (next to it, or inside it when the parent folder is not writable) and then moved in without replacing your files: `AGENTS.md` gains the framework and BitaKit rules (each block once), `CLAUDE.md` gains the `@AGENTS.md` import (when one links to the other, that single file gets the rules), `.gitignore` gains the lines it lacks ahead of your own, so your patterns such as `!.env.example` still win, and agent folders are merged entry by entry. An existing `bitakit-app-development` skill folder is kept whole. Any other generated file you already have is left as yours, and the command names it. A running agent session may not list the new skill; start a new session in the folder.

## What you get

- The official framework project (`create-next-app` or the blank TanStack Start template), with your pages and routes as ordinary framework files.
- Build-time discovery (`withBitaKit` in `next.config.ts`, or the `bitakit()` Vite plugin) and `<BitaKitProvider>` from the generated `src/bitakit.gen.tsx` in the root layout: files in `src/plugins/<name>/` become plugins without a registry.
- A catch-all route that renders plugin pages, and the generated package stylesheet `src/bitakit.gen.css` imported once. `src/bitakit.gen.*` is ignored by Git.
- With Shell: the application layout, the theme script in the root layout, settings pages and `src/configs/shell.ts`. In Next.js, your home page is then `src/app/(app)/page.tsx`, and `src/app/(app)/error.tsx` and `src/app/not-found.tsx` render Shell's replaceable `screen.error` and `screen.not-found` (a plugin file such as `ui/slots/screen.not-found.tsx` replaces them).
- `README.md`, `AGENTS.md` and a `CLAUDE.md` that imports it, plus the `bitakit-app-development` skill in `.agents/skills/` for Codex and `.claude/skills/` for Claude Code. The generated `AGENTS.md` points assistants to the skill for version-aware project inspection, layout/slot selection and focused verification. The `bitakit` command (`@bitakit/cli`, with `@bitakit/discovery` for `bitakit.config.ts`) is a dev dependency. In an existing app, `npx @bitakit/cli init` writes the same guidance and skill. See the [skill README](../cli/skills/bitakit-app-development/README.md) for how to use it.

The generator does not create a backend, authentication, a database or email; those are separate integrations.

## Plugin packages

```sh
npx @bitakit/create-app my-plugin --plugin
```

This creates a package with the same folders as a plugin inside an app (`src/services`, `src/actions`, `src/events.ts`, `src/ui/pages`), a headless test with `mountPlugin`, and a `playground/` app that discovers the plugin source with hot reload and shows the Inspector. `npm run dev` starts the playground, `npm test` runs the tests, `npm run typecheck` checks the types, and `npm run build` runs `bitakit build` to produce `dist/plugin.js`, the entry apps discover through `bitakit.plugin` in `package.json`. `--plugin` accepts `.` under the same rules as an app.

## Contributing

Run `npm test --workspace @bitakit/create-app`. To try the generator against this repository's unpublished packages, pack them and pass the directory: `npm run pack -- <directory>` from the repository root, then `node packages/create-app/src/cli.mjs my-app --packages-dir <directory>`. `npm run verify:generated` generates every project shape from packed packages and checks install, types, build and a browser smoke test.
