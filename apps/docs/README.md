# BitaKit documentation

Independent Fumadocs/Next.js workspace. The canonical developer handbook lives in `content/docs`.
Uses upstream Fumadocs navigation, local Orama search and theme switcher, with the shared
BitaKit navy/gold palette from `apps/brand-theme.css`.

From the repository root:

```sh
npm install
npm run dev:docs
npm run build:docs
```

Development uses port 3002. No BitaKit runtime, auth service or database is required.
Production is a Next.js static export in `apps/docs/out`, deployed by
`.github/workflows/docs-pages.yml` to https://mvavesal.github.io/bitakit/docs/.
The workflow builds the repository subpath supplied by GitHub Pages through
`NEXT_PUBLIC_BASE_PATH` and points `NEXT_PUBLIC_SITE_URL` at the landing page on Vercel.
Set the base path to an empty string for a future root-domain deployment and rebuild.

Search uses Fumadocs' generated `search.json` and its built-in static Orama client.
Next.js owns link prefixes; diagram URLs, search and Markdown fetches include the build's base
path explicitly. Direct page loads use directory indexes (`trailingSlash: true`).
The explicit `/llms.txt`, `/llms-full.txt` and `/llms.mdx/docs/.../content.md` exports remain
available; Pages cannot run the former Accept-header or `.md` suffix proxy rewrites.

Keep an established local preview URL stable when switching checkouts. Verify the process
owning port 3002 before stopping a known docs development server, then run this workspace's
dev command on the same port. The landing page's `NEXT_PUBLIC_DOCS_URL` can point to that
origin in its ignored `.env.local`. To build alongside the running preview, set
`NEXT_BUILD_DIR=.next-build` so the production build does not overwrite the dev cache.

Add reviewed MDX pages under `content/docs`, with title/description frontmatter and navigation
metadata as needed. Follow `/docs/contributing`. Do not add fictitious repository links.
Mark features that are not on npm yet with the release that adds them.

## Introduction and first feature

The homepage introduces what BitaKit is, why its conventions help, and how its pieces fit.
Its additive preview reveals one authored example at a time: navigation, toolbar, Settings,
member menu, owned slots/widgets, Events and Interceptors. Reuse existing Fumadocs controls;
this preview does not execute source code or simulate a second plugin runtime.
Its file tree uses Fumadocs folders and selectable files beside read-only code. File selection
preserves expanded folders and keyboard focus; selecting a step reveals its source path.

The sidebar's **Start here** section leads through a single Counter by level: Basic (Quickstart →
page → service → Action), Intermediate (Settings), Advanced (Events → slot → a second plugin that
extends the Counter without editing it). **Guides** is a separate top-level sidebar group for further topics,
with related mechanisms such as Events and Interceptors next to each other. Its metadata
references existing concept pages so URLs stay stable. **Plugin manager** and **Package
manager** are direct top-level guides. **Plugins**, **Integrations** and **Core packages**
are separate catalogs of app features, provider adapters and development infrastructure. `reference/` retains complete properties and contextual examples. Introduce one idea per step, label partial edits,
and show the expected result. Keep generated-project and package READMEs aligned with this path.

`/docs/concepts/theming` teaches app theme files and the Appearance manager;
`/docs/reference/theming` covers identities, programmatic composition, Actions, storage and CSS.
Their diagrams are diagram-design figures maintained against Shell sources.

## Help illustrations and diagrams

Place visuals directly in the section they explain: Action placement in the Action guide,
Settings anatomy beside generated Settings pages, and custom extension points in the slot guide.
Do not create a separate gallery or repeat the same example at the bottom of a lesson.

- `components/illustrations`: small React/MDX previews for Settings, Action placement, custom extension points,
  event participants, interceptor targets and the Introduction. Shared framing/styles live in `shared.tsx`.
  Reuse Fumadocs controls/code highlighting and the site's theme. Labels/contracts live once in
  `regions.json`; preview selection does not run another application runtime.
- `diagrams/<name>.html`: diagram sources drawn with the diagram-design skill (BitaKit profile).
  `npm run diagrams` derives the dark variant and exports both SVGs to `public/diagrams`;
  `components/diagrams/figures.json` holds each one's title, caption, size and implementation
  references, and `<Figure name>` shows it in both themes.
- `.agents/skills/foundation-development/documentation-visuals.md`: canonical style, authoring
  prompt, tool choices and update checklist. No separate image generation step is needed.

```sh
npm run test --workspace @bitakit/docs
npm run types:check --workspace @bitakit/docs
npm run build:docs
```

The focused tests compare illustrated slot contracts with their source declarations. Review flow
semantics against the referenced implementation; source existence alone does not prove accuracy.
Check the rendered pages on mobile/desktop in both themes after changing examples.
