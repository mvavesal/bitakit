# Contributing to BitaKit

Thank you for helping. BitaKit is a composition layer for apps built from plugins, so most
contributions are small and local: a fix in one package, a docs page, or a plugin of your own.

Everyone who takes part follows the [code of conduct](CODE_OF_CONDUCT.md). Report security
issues privately, as described in [SECURITY.md](SECURITY.md), never in a public issue.

## Ways to contribute

From the easiest to the largest:

1. **Report a bug or suggest an idea.** Open an [issue](https://github.com/mvavesal/bitakit/issues/new/choose)
   with the matching template. Questions and open-ended ideas belong in
   [Discussions](https://github.com/mvavesal/bitakit/discussions).
2. **Improve the docs or the sample apps** in `apps/docs` and `examples/`.
3. **Publish your own plugin.** A plugin can live in your repository and npm scope; it does
   not need to be in this repository. Open a pull request that adds it to the
   [integrations page](apps/docs/content/docs/integrations.mdx) once it is published.
4. **Change a package** in `packages/`. Small fixes can go straight to a pull request.
5. **Propose a change to the API or the architecture.** Open an issue with the _Proposal_
   template first and wait for a maintainer to agree before you write the code.

Issues labelled [`good first issue`](https://github.com/mvavesal/bitakit/labels/good%20first%20issue)
and [`help wanted`](https://github.com/mvavesal/bitakit/labels/help%20wanted) are a good
place to start. Comment on an issue before you start, so two people do not do the same work.

## Set up

You need Node.js 24 and npm 10 or newer.

```sh
git clone https://github.com/<you>/bitakit.git
cd bitakit
npm run setup
```

`npm run setup` installs the dependencies and builds the packages. Then:

| Command                   | What it does                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| `npm test`                | All package tests, the version check and the agent guides           |
| `npm run format:check`    | Formatting (`npm run format` fixes it)                              |
| `npm run dev:docs`        | The documentation at http://localhost:3002                          |
| `npm run verify:examples` | Installs, builds and checks every sample app (slow, needs internet) |

## Make a change

1. Fork the repository and create a branch from `main`.
2. Read the nearest `AGENTS.md`. It holds the conventions for that folder, for people and coding
   agents alike; the root [AGENTS.md](AGENTS.md) covers the whole repository.
3. Keep the change focused: one fix or one feature per pull request.
4. Add or update tests next to the code you change.
5. Update the docs and the package's `AGENTS.md` in the same pull request when a public API
   changes.
6. If you change what a published package ships, add a changeset:

   ```sh
   npm run changeset
   ```

   Choose `patch`. Do not edit package versions or `CHANGELOG.md` files by hand; releases run
   from `main` (see [the release section](apps/docs/content/docs/contributing.mdx#release)).

7. Run `npm test` and `npm run format:check`, then open a pull request and fill in the template.

### Commits and sign-off

Write commit messages in English, in the imperative ("Add a slot for …"). Sign off every commit
to confirm the [Developer Certificate of Origin](https://developercertificate.org/), which says
you have the right to submit the change under the project's [MIT license](LICENSE):

```sh
git commit -s -m "Fix the settings search on narrow screens"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line. Use your real name and an email
address you can be reached at.

### Coding agents and AI tools

You may use AI tools. You are responsible for every line you submit:

- Read and understand the change before you open the pull request, and test it.
- Disclose significant AI help with an `Assisted-by:` line in the commit message, for example
  `Assisted-by: Claude Code`, and tick the box in the pull request template.
- Answer review comments yourself; do not let an agent reply on your behalf.
- Do not submit code you do not have the right to license under MIT.

Maintainers may close pull requests that ignore these points without a detailed review.

## Review

A maintainer reviews every pull request. CI must pass: formatting, every package test, the
version check and the docs build. Expect questions; they are about the change, not about you.
Once it is approved, a maintainer merges it, and the next release publishes it.

## Language

Code, comments, documentation and discussions are in English. Product translations live in
each package's `locales/` folder and are welcome in any language.

## Questions

Ask in [Discussions](https://github.com/mvavesal/bitakit/discussions). How decisions are made
is described in [GOVERNANCE.md](GOVERNANCE.md).
