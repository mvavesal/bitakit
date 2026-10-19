# BitaKit app development with Codex or Claude Code

Use this skill to build a feature in the right place in a BitaKit app. It helps the agent inspect
the app's installed packages and layout, choose the plugin that owns the feature, find a real
rendered extension point, and verify the result. It favors a page first, then adds only the
services, Actions, settings or slots the feature needs.

## Install in a project workspace

Run the command for your agent from the workspace where you want the skill available. These
commands install a project copy, not a user-global skill. `--copy` keeps the skill files in the
repository instead of creating a symlink.

This GitHub source URL pins the tested skill snapshot. The branch name contains a slash, which the
Skills CLI currently parses as two URL path segments; use the commit URL rather than the branch
URL. Replace the commit with a newer one when you want a later skill revision.

### Codex

```sh
npx skills add 'https://github.com/mvavesal/bitakit/tree/93cb760ec97e3a1f809ffecfc33646f76897a78e/packages/cli/skills/bitakit-app-development' \
  --skill bitakit-app-development --agent codex --copy --yes
```

This installs to `.agents/skills/bitakit-app-development/`. Ask Codex:

> Use the `bitakit-app-development` skill. Add a Counter feature under `src/plugins/counter/`
> that displays 0 and increments when I click its button. Check the selected layout before adding
> navigation. Then typecheck, run Doctor, and verify `/counter` in the browser.

### Claude Code

```sh
npx skills add 'https://github.com/mvavesal/bitakit/tree/93cb760ec97e3a1f809ffecfc33646f76897a78e/packages/cli/skills/bitakit-app-development' \
  --skill bitakit-app-development --agent claude-code --copy --yes
```

This installs to `.claude/skills/bitakit-app-development/`. Use the native skill command:

```text
/bitakit-app-development Add a Counter feature under src/plugins/counter/ that displays 0 and
increments from a button. Check the selected layout before adding navigation, then typecheck, run
Doctor, and verify /counter in the browser.
```

The command names and folders differ by host. BitaKit's generated `CLAUDE.md` imports `AGENTS.md`
project instructions, but that alone does not install a native Claude Code skill or create its
slash command. For Codex skill discovery guidance, see [Codex skills](https://learn.chatgpt.com/docs/build-skills);
for Claude Code, see [skills](https://code.claude.com/docs/en/skills). The standard installer is
[`npx skills`](https://github.com/vercel-labs/skills).

## What success looks like

The Counter has a `/counter` page that shows a count and an Action-bound button that increments
it. The agent checks the current framework and installed BitaKit versions, keeps feature files in
`src/plugins/counter/`, inspects any layout outlet before placing navigation, and reports the
focused typecheck, Doctor and browser results. A slot declaration by itself is not proof that a
chosen layout renders that slot.

For a first page with no behavior, start with only `src/plugins/counter/ui/pages/index.tsx`. When
the feature needs state and an operation, a small plugin can keep a record in `services.ts` and a
record in `actions.ts`; split them into named files as the feature grows. React stays in `ui/`.

## New and existing apps

On this source branch, `create-app` and `bitakit init` copy the skill into the app's
`.agents/skills/` directory and point generated `AGENTS.md` to it. This supplies project-local
Codex guidance for later work. For Claude Code, run its install command above from the app root
when you want the native `/bitakit-app-development` skill there too.

The change is not in the current published npm packages yet. To create or initialize an app from
this source branch, use the [local checkout guide](../../../../apps/docs/content/docs/local-development.mdx).
After release, the regular BitaKit create and init commands will deliver the project copy.

The Skills CLI was verified to copy this skill into both host-specific folders in an isolated
workspace. That verifies installation paths, not automatic activation in a fresh Codex, Claude
Code or cloud session. The guide supports Next.js and TanStack Start consumer apps; it does not
promise that every framework layout or responsive state has been exercised. GitHub access is
required to fetch the source; for a private fork, use your existing Git or GitHub CLI credentials.
