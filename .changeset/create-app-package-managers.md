---
'@bitakit/create-app': patch
---

Install the new app with the package manager that started the generator (`npm create`,
`pnpm create`, `yarn create`, `bunx`), or the one named with `--package-manager`; the summary,
next steps and the generated README use its commands. Plugin packages stay npm workspaces.
`yarn create @bitakit/app` works with Yarn 1 through a `create-app` bin. Generated apps require
`@bitakit/shell` 0.2.6 or newer: their error and not-found files need its 0.2.5 APIs and Yarn
needs its declared peers, so a resolver that skips fresh releases cannot install an older Shell.
