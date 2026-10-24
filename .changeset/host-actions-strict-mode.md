---
'@bitakit/ui': patch
---

The plugin management Action (`runtime.plugins.change`) binds whenever the runtime is ready and
idle. Before, an app whose plugins have no `onStart` hooks logged
`[bitakit] Host Actions could not start` in React Strict Mode (every development page load) and
left the Action unbound, because the runtime was stopped for Strict Mode's second mount when the
binding ran and nothing retried it.
