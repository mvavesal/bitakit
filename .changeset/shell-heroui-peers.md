---
'@bitakit/shell': patch
---

Declare HeroUI's peer dependencies (`react-aria`, `react-aria-components`, `@react-aria/utils`,
`@react-aria/ssr`, `@internationalized/date`) as Shell dependencies, so apps installed with
Yarn, which does not install peers, build. npm and pnpm resolve the same versions as before.
