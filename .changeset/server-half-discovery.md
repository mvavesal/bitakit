---
'@bitakit/discovery': patch
---

Discovery reads plugins' `server/` folders (`server/actions`, `server/services`, `server/interceptors` and `server/contributions/<directory>`) and writes `src/bitakit.gen.server.ts` while a module has server content, with `remote` in the client config for the exposed operations; it removes the file again when the server content is gone. Contribution kinds may declare `runtime: 'client' | 'server' | 'both'`, and a file on the wrong side is a generation error naming where it belongs (a task under `server/contributions/tasks/`, ignored before, is now such an error). Generation also rejects client-only fields, a missing `access` and reserved names in server Actions, and `access`, `expose` or `output` in client Actions. `bitakit.config.ts` accepts `server: { endpoint }`, and `describeModule`/`describeBitaKit` report each module's server files. Server content needs `@bitakit/core` 0.3.2 or later.
