<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BitaKit documentation site

The developer handbook for BitaKit: a Fumadocs site (Next.js) whose pages are MDX files in
`content/docs`. Write all pages in English. Read `DESIGN.md` before changing anything visual.

## Structure (Diátaxis)

Every page has one job. Decide which before writing, and put it in the matching section; the
sidebar comes from the `meta.json` files, so a page's URL does not change when it moves
between sections.

| Section (sidebar)    | Kind                          | Where                                                                                       |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Get started          | Explanation and first lessons | `index.mdx`, `why-bitakit.mdx`, `motivation.mdx`, `quickstart.mdx`, the Counter lessons in `concepts/` (`concepts/meta.json`), `examples.mdx` |
| How-to guides        | Recipes for one task          | `guides/*.mdx`; `guides/meta.json` also lists how-to pages kept elsewhere                   |
| Concepts             | Explanation                   | `explanation/meta.json` lists pages in `concepts/`                                          |
| Reference            | Lookup                        | `reference/*.mdx`, `cli.mdx`, `packages.mdx`, `plugins.mdx`, `integrations.mdx`             |
| Advanced tutorials   | Longer lessons                | `advanced/meta.json` lists the plugin manager, package manager and Node walkthrough         |

A page appears in the sidebar once: list it in exactly one `meta.json`. Each page has `title`
and `description` frontmatter.

## How each kind of page reads

- **Lesson (tutorial):** one outcome, numbered steps with `<Steps>`/`<Step>`, the visible
  result after each step, then "Next".
- **How-to guide:** start with **Goal** and **You need** (prerequisites and the sample app that
  holds the finished code), then `<Steps>`, then **Check it** (exact clicks and expected
  result), then options in a short table. Show complete files with a `title="src/..."` path.
- **Explanation:** the problem first, then why the design solves it. State numbers only when
  they are measured (`npm run measure:onboarding` in the repository root) and say how.
- **Research:** `motivation.mdx` ("Goals and research") collects the studies behind BitaKit's
  goals. Add every new finding in that direction there, for or against a goal: one or two
  sentences under the goal with a numbered reference, and the full reference (authors, linked
  title, venue, date, what was measured) in its list. Other pages link to it instead of
  repeating the evidence.
- **Reference:** tables of properties and IDs; no narrative.

## Code in pages

- Install, create and run commands go in ```` ```npm ```` blocks: Fumadocs turns them into
  npm/pnpm/yarn/bun tabs and remembers the reader's choice (`lib/source.ts`). Create apps with
  `npm create @bitakit/app@latest <dir> -- <options>`, which converts correctly for every package
  manager. Keep `npx bitakit …` and `npm update` in ```` ```sh ```` blocks: the tab conversion
  would turn them into `pnpm dlx`, which runs a different package.
- How-to guides copy their code from the apps in `examples/`. `tests/example-snippets.test.mjs`
  fails when a block titled with a file path differs from that file in its sample app; mark
  partial or illustrative blocks with a note in the title, for example `title="… (excerpt)"`.
  Change the sample first, verify it (`npm run verify:examples -- --only <app>`), then copy it.
- Use only APIs that exist in this checkout; link only pages and files that exist.

## Components

Fumadocs defaults plus `Callout`, `Cards`/`Card`, `Steps`/`Step`, `Files`/`Folder`/`File`,
`Figure`, `MeasuredStats`, `PluginSizes` and the illustrations registered in `components/mdx.tsx`.

Diagrams: draw them with the diagram-design skill in the BitaKit profile (the repository's
`.diagram-design` selects it). The source is `diagrams/<name>.html` (light skin);
`npm run diagrams -- <name>` from the root derives the dark variant and exports both SVGs to
`public/diagrams`. Add title, caption, size and source references to
`components/diagrams/figures.json` and show it with `<Figure name="<name>" />`. Never edit an
exported SVG; the tests check every figure's exports, references and page usage. Reuse them; do not add a
second visual system or local styles (see `DESIGN.md`, which also covers diagrams).

## Checks

From the repository root: `npm run build:docs` and `npm test --workspace @bitakit/docs`. For
visible changes, open the page with `npm run dev:docs` (port 3002) and check navigation,
search, a narrow window and both themes. `npm run format:check` covers the MDX files.
