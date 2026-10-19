# BitaKit app development skill

An [Agent Skill](https://agentskills.io) that teaches Codex, Claude Code and other coding agents
to build BitaKit apps the BitaKit way. Ask for a feature in plain words; the agent creates the
plugin, adds pages, Actions, services, events, settings, interceptors and slots in the right
files, checks the result in the browser and explains what it built.

This README is for people. Agents read [SKILL.md](SKILL.md) and the recipes in
[references/](references/).

## Get the skill

Requires `@bitakit/create-app` or `@bitakit/cli` 0.2.2 or later.

**New app.** The generator includes the skill:

```sh
npx @bitakit/create-app@latest my-todos --sample --yes
```

In a folder your agent already has open, with nothing but `.git` and agent files, use `.` as the
directory so the skill lands there.

**Existing Next.js or TanStack Start app.** Run this from the app folder; it wires BitaKit and
adds the skill:

```sh
npx @bitakit/cli@latest init
```

Both write the same files into the app, ready to commit so collaborators get them too:

| File                                        | Read by                                                      |
| ------------------------------------------- | ------------------------------------------------------------ |
| `.agents/skills/bitakit-app-development/`   | Codex, and also Cursor, GitHub Copilot, Gemini CLI, OpenCode |
| `.claude/skills/bitakit-app-development/`   | Claude Code                                                  |
| `AGENTS.md` (BitaKit block) and `CLAUDE.md` | Every agent: the one-screen rules, pointing to the skill     |

A skill folder you edited is never overwritten, so a team can adapt its copy.

## Use it

Open the agent **in the app folder**: Codex only looks for skills from the current folder up,
and a session started in a parent folder will not see the app's skill. Restart a session that
was already open when the skill was added.

| Agent       | Ask                                                                            |
| ----------- | ------------------------------------------------------------------------------ |
| Codex       | `$bitakit-app-development` followed by your request, or pick it with `/skills` |
| Claude Code | `/bitakit-app-development` followed by your request                            |
| Cursor      | Type `/`, pick `bitakit-app-development`, add your request                     |

Agents also load the skill on their own when a request matches it ("add a page", "put a button
in the toolbar"); naming it is the reliable way.

## Try it on the Todo sample

The sample from the command above has two plugins: `todos` owns the list, and `activity` shows
recent changes below it without touching `todos`. Run `npm run dev` and try these requests in
order; each one is small, and each teaches one building block.

| Request                                                                                         | What you learn                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| "Add an About page at /about with a link in the sidebar."                                       | A plugin, a page and a navigation Action   |
| "Show the number of todos in the app header from a new `summary` plugin. Don't change `todos`." | Filling another feature's slot             |
| "Don't allow adding a todo that is already on the list."                                        | An interceptor that blocks an Action       |
| "Let other features add buttons above the todo list."                                           | Declaring and rendering a new slot         |
| "Add a Print list button to that toolbar from a new `print` plugin."                            | Placing an Action in another plugin's slot |
| "Let users choose whether new todos go to the top of the list."                                 | A setting with a generated Settings field  |
| "Explain how `activity` adds its list under the todos without changing `todos`."                | Events and slots, explained                |
| "Write a test for the duplicate rule, then show me the todos page in the browser."              | Tests and the browser check                |

For your own app, describe the feature in your domain's words: "Add a Recipes page where I can
save a recipe with a title and ingredients" works the same way.

## What the skill covers

| Task                                                                     | Recipe                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Create a plugin, a page or a sidebar link                                | [plugins-and-pages.md](references/plugins-and-pages.md)     |
| Add an Action and bind it to a button or link                            | [actions.md](references/actions.md)                         |
| Keep shared state, use another plugin's service, send and receive events | [services-and-events.md](references/services-and-events.md) |
| Declare a slot, render it, contribute to one                             | [slots.md](references/slots.md)                             |
| Block, check or observe Actions                                          | [interceptors.md](references/interceptors.md)               |
| Add a user setting                                                       | [settings.md](references/settings.md)                       |
| Test a plugin and check it in the browser                                | [testing-and-preview.md](references/testing-and-preview.md) |

Before every change the agent reads the app's packages, runs `npx bitakit info --json`,
`npx bitakit slots` and `npx bitakit doctor`, and checks which layout renders the place it wants
to use. After the change it runs the typecheck and doctor, opens the page in the browser, and
tells you what it built, where it appears, how it connects and what it checked.

## Keep the skill current

Each installed `SKILL.md` records the BitaKit version it came from and a checksum of its files.
`npx bitakit doctor` warns when a copy is missing or older than the app's `@bitakit/cli`, when the
two copies differ, or when the BitaKit block in `AGENTS.md` no longer matches. After upgrading the
BitaKit packages, run:

```sh
npx bitakit init --update-agent-files
```

It adds a missing copy, replaces an unedited older copy and refreshes the BitaKit block in
`AGENTS.md`; keep your own rules outside that block. A copy you edited is kept: delete its folder
and run the command again to take the new version, then reapply your changes.

## Before an app exists

The skill lives inside apps, so it cannot help create the very first one. Either run the
`create-app` command yourself and open the agent in the new folder, or install a personal copy
that every session can use. Copy this folder (from `node_modules/@bitakit/cli/skills/` of any
BitaKit app, or from this repository), leaving out this README:

| Agent       | Personal skill folder                       |
| ----------- | ------------------------------------------- |
| Codex       | `~/.agents/skills/bitakit-app-development/` |
| Claude Code | `~/.claude/skills/bitakit-app-development/` |

Claude Code prefers a personal skill over a project one with the same name, so remove the
personal copy when you work in apps that ship a newer skill.
