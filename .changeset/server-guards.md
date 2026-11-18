---
'@bitakit/core': patch
'@bitakit/orpc': patch
'@bitakit/mcp': patch
---

Server guards: CORS for `trustedOrigins` (preflight and response headers, never `*`; `crossOrigin` for other transports), rate limits for exposed `public` operations over HTTP (`createServer(config, { rateLimit })`, 120 a minute per client by default, 429 with `Retry-After`, replaceable store), and `server.system(name, { organizationId, permissions })`, the principal for jobs and webhooks that grants exactly the given permissions and never comes from a request. `OperationError` carries `retryAfter`.
