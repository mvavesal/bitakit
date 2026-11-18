---
'@bitakit/orpc': patch
'@bitakit/core': patch
---

New optional package `@bitakit/orpc`: an oRPC transport over the server's exposed operations – `orpcHandler(server, { prefix, protocol })` for oRPC's RPC protocol or REST, `openapiDocument(server, { prefix })` for the OpenAPI 3.1 document – calling them through `server.call(…, { exposedOnly: true })`. Core exports `originRule`, the Origin check of `fetchHandler`, for such transports.
