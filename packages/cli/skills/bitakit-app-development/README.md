# BitaKit app development skill

Create and extend BitaKit apps with Codex or Claude Code. This skill guides your agent through inspecting the app, building self-contained features, and checking the result.

For an existing app, install `@bitakit/cli`, then run this from its project folder:

```sh
npx bitakit init
```

`init` wires BitaKit into a supported app and installs this skill for Codex and Claude Code, preserving existing skill files. For a new app, the BitaKit app generator installs the skill as part of app creation.

## Codex

```text
$bitakit-app-development
```

## Claude Code

```text
/bitakit-app-development
```

## Try it

- **New app:** “Create a BitaKit app for tracking books. Help me choose its framework and layout.”
- **New feature:** “Add a Counter page under `src/plugins/counter/` with an increment button. Use the existing layout and verify the result.”

## What the skill helps with

| Task | Guidance |
| --- | --- |
| Create a plugin | Scaffold a feature with `npx bitakit add plugin <name>`. See [Plugins](../../../../apps/docs/content/docs/concepts/plugins.mdx) and the [CLI guide](../../../../apps/docs/content/docs/cli.mdx). |
| Add a service | Keep shared feature state and behavior in its owning plugin. See [Services](../../../../apps/docs/content/docs/concepts/services.mdx). |
| Define an Action | Expose an operation through BitaKit's Action contract and bind it to UI. See [Actions](../../../../apps/docs/content/docs/concepts/actions.mdx). |
| Add an interceptor | Observe or gate existing Action or service calls. See [Interceptors](../../../../apps/docs/content/docs/concepts/interceptors.mdx). |
| Inspect slots | Use `npx bitakit info --json` for source declarations it can resolve, then inspect the owner and selected layout to confirm a renderer actually uses the slot. The inventory is not proof that every slot or outlet is present at runtime. See the [CLI guide](../../../../apps/docs/content/docs/cli.mdx) and [slot reference](../../../../apps/docs/content/docs/reference/slots.mdx). |
| Define a slot contract | Add an owned contract with `npx bitakit add slot-definition <plugin>/<name>`. See [Slots](../../../../apps/docs/content/docs/concepts/slots.mdx) and the [CLI guide](../../../../apps/docs/content/docs/cli.mdx). |
| Contribute to a slot | Add UI with `npx bitakit add slot <plugin>/<slot>` only when the owner provides a compatible component outlet; Actions can also declare their slot placements. See [Slots](../../../../apps/docs/content/docs/concepts/slots.mdx) and the [slot reference](../../../../apps/docs/content/docs/reference/slots.mdx). |

Features start with a page under `ui/`. Add flat `services.ts` and `actions.ts` files only when needed; add settings and slot contributions when the feature calls for them. The agent inspects existing contracts and the app's actual layout before placing UI.

Installing the skill adds agent instructions, not app dependencies. `init` wires a supported existing app and reports any BitaKit packages it still needs; install the packages required by the app's features.
