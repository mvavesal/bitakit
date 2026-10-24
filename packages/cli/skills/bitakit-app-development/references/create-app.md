# Create an app or a standalone plugin package

Use this for a new project. Extend an existing app with its installed CLI instead of
scaffolding another app around it.

## New application

Default to Next.js; use TanStack Start (experimental) when the user requests it.

```sh
npx @bitakit/create-app@latest <directory> --framework next --features <list|none> --yes
```

- `--features` is a comma-separated subset of `preferences`, `shell` and `quick-search`, or
  `none`. Without it the app gets `shell,quick-search` (a sidebar frame, Settings and search).
  Choose features from the user's requirements; add `--sample` for the working Todo sample.
- `--yes` skips interactive prompts. In an empty session folder, or one containing only `.git`
  and agent/editor files, use `.` as the directory. The generator preserves and merges those
  files so the app and its skill land in the folder the agent can see.
- Otherwise use a new directory. Continue from that app folder and read its `AGENTS.md` and
  `.agents/skills/bitakit-app-development/SKILL.md`. A session that started before the skill
  existed may need a restart to discover it automatically.
- Follow existing network/install authorization and environment approval controls. If a command
  is blocked, report the blocker; do not imitate the generator by hand.

The generator installs with the package manager that started it; the `npx` form uses npm.
For pnpm, Yarn or Bun, start it with that tool and the same arguments, or pass
`--package-manager <npm|pnpm|yarn|bun>`. Keep that package manager for later installs; a
standalone plugin package always uses npm.

```sh
pnpm create @bitakit/app <directory> --framework next --features <list|none> --yes
yarn create @bitakit/app <directory> --framework next --features <list|none> --yes
bunx @bitakit/create-app@latest <directory> --framework next --features <list|none> --yes
```

For a learning app with the sample:

```sh
npx @bitakit/create-app@latest my-todos --framework next --sample --yes
```

The `todos` plugin owns the list; `activity` listens to `todos.changed` and fills `todos.footer`.
Run the app's dev script, open `/todos`, add a todo and confirm it appears in both the list and
the activity feed. The other recipes extend this sample, with prerequisites named in each one.

## Standalone plugin package

```sh
npx @bitakit/create-app@latest notes-plugin --plugin --framework next --yes
```

This creates a plugin with source under `src/`, its own `AGENTS.md` and Claude import, headless
tests and a playground app. Follow its generated package guide: add contributions with
`npx bitakit add action <name>` (no app plugin prefix), run `npm test`, `npm run typecheck`
and `npm run build`, and try it with `npm run dev`. Do not run `bitakit add plugin` inside
the package. App-specific paths in other recipes must be adapted to this package layout.
