# BitaKit documentation

Independent Fumadocs/Next.js workspace. English MDX content lives in `content/docs`.
Uses the upstream Fumadocs theme, navigation, local Orama search and theme switcher.

From the repository root:

```sh
npm install
npm run dev:docs
npm run build:docs
```

Development and production start use port 3002. No Foundation runtime, auth service or database
is required to run this site. For production, build this workspace and run its `start` script,
or configure a Next.js-compatible deployment with `apps/docs` as the application directory
and the repository workspace lockfile available. Nothing is deployed automatically.

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

The sidebar's **Start here** section leads through a single Counter: Quickstart → page → service → Action
→ slot → Settings. `reference/` retains complete properties and contextual examples. Advanced
runtime topics stay after the basic lessons. Introduce one idea per step, label partial edits,
and show the expected result. Keep generated-project and package READMEs aligned with this path.

`/docs/concepts/theming` teaches app theme files and the Appearance manager;
`/docs/reference/theming` covers identities, programmatic composition, Actions, storage and CSS.
Their diagrams reuse the shared Mermaid renderer and are maintained against Shell sources.

## Help illustrations and diagrams

Place visuals directly in the section they explain: Action placement in the Action guide,
Settings anatomy beside generated Settings pages, and custom extension points in the slot guide.
Do not create a separate gallery or repeat the same example at the bottom of a lesson.

- `components/illustrations`: small React/MDX previews for Settings, Action placement, custom extension points,
  event participants, interceptor targets and the Introduction. Shared framing/styles live in `shared.tsx`.
  Reuse Fumadocs controls/code highlighting and the site's theme. Labels/contracts live once in
  `regions.json`; preview selection does not run another application runtime.
- `components/diagrams/charts.mjs`: shared Mermaid text, captions and implementation references.
  `Diagram` uses the server renderer documented by Fumadocs; CSS variables adapt to both themes.
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
