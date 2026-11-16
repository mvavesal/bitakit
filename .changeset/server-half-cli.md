---
'@bitakit/cli': patch
---

`bitakit add action|service|interceptor <plugin>/<name> --server` writes into the plugin's `server/` folder; for an Action it also writes a `mountServer` test (a member, a member of another organization, a signed-out caller), the button that calls the operation through `remote` and, when no route serves it yet, the RPC route. `bitakit doctor` checks the server boundary (browser code that reaches a `server/` folder, `@bitakit/core/server` or the generated server file; server code that imports React or its `ui/`) and warns about a missing RPC route, a missing `requestContext` provider or a discovery without server support. `info` lists server Actions, services and interceptors as `server:<id>`, `generate` names the server file, and the agent rules gain a server row. The app-development skill has a new `references/server.md` recipe, and its data recipe keeps the data in the plugin's server half instead of an API route.
