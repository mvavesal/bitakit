# @bitakit/create-app — guide for agents

> For agents building an app with this package. To change the package itself, follow the
> repository's own AGENTS.md instead.

Creates a BitaKit app (Next.js by default, TanStack Start experimental) or a standalone plugin
package, and installs the agent files: `AGENTS.md`, `CLAUDE.md` and the
`bitakit-app-development` skill.

## Create

```sh
npx @bitakit/create-app@latest <directory> --framework next --features <list|none> --yes
```

- `--features`: comma-separated `preferences` (Settings), `shell` (frame) and `quick-search`, or
  `none`; without it the app gets `shell,quick-search`. Add `--sample` for the Todo sample.
- `--yes` skips prompts. Use `.` as the directory when the folder holds only `.git` and agent
  files; existing agent files are kept and merged.
- `--plugin` creates a plugin package with a playground app.

## What an app gets

The generated provider and catch-all route, `src/configs/` for package options, Settings and
Shell routes (with those features), Next.js `error.tsx` and `not-found.tsx` that render Shell's
replaceable screens, and `npm run typecheck`. Feature code goes into `src/plugins/<id>/`; the
skill explains the rest.

## Rules

- Scaffolding needs network access; if a sandbox blocks it, ask instead of writing generated
  files by hand.
- Suggest `git init` and a first commit after creating an app.
