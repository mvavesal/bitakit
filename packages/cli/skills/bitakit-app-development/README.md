# Build BitaKit apps with an agent

The `bitakit-app-development` skill guides Codex and Claude Code through adding features to a
BitaKit app. It helps the agent find the feature's owner, inspect the selected layout and its real
extension points, and verify the result. It is guidance for the coding agent, not a BitaKit
runtime package.

## Install the skill

The `skills` command installs a project-local copy for each agent. To use the skill from this
branch before it is merged, run this from your app directory and replace `/path/to/bitakit` with
the path to your existing BitaKit checkout:

```sh
npx skills add "/path/to/bitakit/packages/cli/skills/bitakit-app-development" \
  --agent codex --agent claude-code --copy
```

After this branch is merged into the default branch, you can install it directly from the
repository:

```sh
npx skills add mvavesal/bitakit --full-depth --skill bitakit-app-development \
  --agent codex --agent claude-code --copy
```

The installer copies the skill into `.agents/skills/` for Codex and `.claude/skills/` for Claude
Code. The npm command above runs the Skills CLI; the BitaKit skill itself is a folder in the
repository and does not need a separate npm release. See the [Skills CLI documentation](https://github.com/vercel-labs/skills#readme)
for installer options.

## Use the skill

In Codex, invoke `$bitakit-app-development`. In Claude Code, use `/bitakit-app-development`.
For example:

> Create a new BitaKit app for tracking books. Choose the framework and layout to fit the
> requirements; add a sidebar only if it helps.

For a feature in an existing app:

> Add a Counter page under `src/plugins/counter/` that starts at 0 and increments from a button.
> Check the selected layout before adding navigation, then typecheck and verify `/counter`.

The skill starts with a page under `ui/`, then adds `services.ts` or `actions.ts` only if the
feature needs them. Keep React in `ui/` and place navigation only where the selected layout has a
real rendered outlet.

An existing app must have the BitaKit packages needed for the requested work. For a new app, the
skill uses the separate BitaKit `create-app` generator. Installing this skill installs its
instructions only; it does not install app dependencies.
