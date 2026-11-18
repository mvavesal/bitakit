---
'@bitakit/core': patch
'@bitakit/discovery': patch
'@bitakit/cli': patch
---

The generated server takes its rate limits from `bitakit.config.ts` (`server.rateLimit: { limit?, windowMs? } | false`, checked at generation). Who the client is and a shared store are code: a server service that provides the new `rateLimit` contract (`@bitakit/core/server`) supplies `key` and `store`; options passed to `createServer` win over it. A server now drains a public call that is still waiting in an async rate-limit store before it stops. The app skill and the server docs now describe the built-in rate limit, CORS for trusted origins and the transport packages.
