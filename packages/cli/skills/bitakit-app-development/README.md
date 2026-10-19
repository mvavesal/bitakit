# BitaKit app development skill

Create and extend BitaKit apps with Codex or Claude Code. This skill guides your agent through inspecting the app, building self-contained features, and checking the result.

Run the installation command for your coding assistant from your project folder.

## Codex

```sh
npx skills add mvavesal/bitakit --full-depth --skill bitakit-app-development --agent codex --copy
```

Use `$bitakit-app-development` in Codex.

## Claude Code

```sh
npx skills add mvavesal/bitakit --full-depth --skill bitakit-app-development --agent claude-code --copy
```

Use `/bitakit-app-development` in Claude Code.

## Try it

- **New app:** “Create a BitaKit app for tracking books. Help me choose its framework and layout.”
- **New feature:** “Add a Counter page under `src/plugins/counter/` with an increment button. Use the existing layout and verify the result.”

Features start with a page under `ui/`. Add flat `services.ts` and `actions.ts` files only when needed. The agent uses existing BitaKit services, Actions, settings and slot contracts, and checks the app's actual layout before placing UI.

Installing the skill adds agent instructions, not app dependencies. New apps use the separate BitaKit app generator; existing apps need the BitaKit packages required by their features.
