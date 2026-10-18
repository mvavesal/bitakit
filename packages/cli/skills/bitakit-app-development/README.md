# Try the BitaKit app development skill

`SKILL.md` is the canonical app-authoring guide. This README is a short, human-facing quick start
for trying it with Codex. For the full local package workflow and options, see the repository's
[Use this checkout guide](../../../../apps/docs/content/docs/local-development.mdx).

## Before creating an app

Put the skill in the project workspace before asking Codex to create an app. From the BitaKit
checkout:

```sh
mkdir -p .agents/skills/bitakit-app-development
cp packages/cli/skills/bitakit-app-development/SKILL.md .agents/skills/bitakit-app-development/SKILL.md
```

If the CLI is already installed in that workspace, copy from
`node_modules/@bitakit/cli/skills/bitakit-app-development/SKILL.md` instead. These commands use a
project-local skill file; they do not change Codex's user-global settings.

To try this **unreleased source branch** in a fresh consumer, run the following from the BitaKit
checkout. This packs the changed local packages and runs the local app generator, so the result
does not depend on the current npm release:

```sh
npm ci
npm run pack -- .tmp/app-skill-packages core discovery ui next cli
node packages/create-app/src/cli.mjs ../my-app \
  --framework next --features none --yes \
  --packages-dir "$PWD/.tmp/app-skill-packages"
```

The destination must not already exist. After generation, open `../my-app` as the app workspace;
the generated project includes its own skill copy and `AGENTS.md` reference. The command uses the
repository's existing pack-and-create workflow; it does not publish packages.

If the feature has been released, the ordinary `npx @bitakit/create-app ...` workflow is enough.
The current published npm packages do **not** contain this unreleased change yet.

## Use it with an existing app

In an existing supported Next.js or TanStack Start app, run the CLI source from this checkout so
`init` uses the unreleased implementation. Install the checkout dependencies once, then replace
the two paths below with the absolute checkout and app paths:

```sh
npm ci
(cd /absolute/path/to/my-app && \
  node /absolute/path/to/bitakit/packages/cli/src/cli.mjs init)
```

Then use the app's usual package manager to install any dependencies that `init` reports as
missing, and run its generation and Doctor checks:

```sh
cd /absolute/path/to/my-app
npx bitakit generate
npx bitakit info --json
npx bitakit doctor --json
```

This invokes the source branch directly; it does not install or publish a package. Once released,
the normal `npx bitakit init` command from the app uses the published CLI. The current published
npm packages do not contain this unreleased change yet.

## Give Codex a feature request

For example:

> Add a counter feature under `src/plugins/counter/` with a count service, an increment Action,
> and a page. Inspect the selected layout's actual navigation outlet before adding navigation.
> Keep the implementation in the counter plugin, then typecheck, run Doctor, and verify the page
> and increment in the browser.

The skill asks the agent to inspect installed versions and the selected layout before choosing an
extension point. A slot declaration alone does not prove that the layout renders it. For Shell,
the sidebar and navbar do not show the same outlets, so the agent should verify the chosen layout.

## Support and verification boundaries

The skill guides app-level changes in BitaKit consumer projects; it is not a substitute for the
separate package-development guidance. Generated apps and `bitakit init` include the skill, but
automatic skill discovery varies by host. Codex can read the project-local file directly; this
does not verify discovery in a separate fresh session or another agent host.

The local acceptance exercised one packed Next.js consumer, `bitakit init`, typechecking, Doctor,
and a browser-rendered counter in the built-in sidebar layout. It does not establish behavior for
every framework layout, responsive state, host or published npm version. Run focused checks for
the app and layout you are changing.
