---
'@bitakit/core': patch
'@bitakit/discovery': patch
'@bitakit/cli': patch
---

Packages ship server halves: `bitakit build` writes `dist/server.js`, `dist/server.d.ts` and `dist/server.json` for a package's `server/` folder (and the browser entry now carries its `installers/`); a package declares it with `bitakit.server`, and an app's generated server file loads it. The app decides which package operations go over HTTP with `server.publish` in `bitakit.config.ts` (`ServerOptions.publish`); installing a package never adds endpoints by itself. The CSS audit skips the server entry.
