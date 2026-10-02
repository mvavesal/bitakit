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
