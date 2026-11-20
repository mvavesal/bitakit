# @bitakit/orpc

## 0.3.1

### Patch Changes

- a8f1ce8: New optional package `@bitakit/orpc`: an oRPC transport over the server's exposed operations – `orpcHandler(server, { prefix, protocol })` for oRPC's RPC protocol or REST, `openapiDocument(server, { prefix })` for the OpenAPI 3.1 document – calling them through `server.call(…, { exposedOnly: true })`. Core exports `originRule`, the Origin check of `fetchHandler`, for such transports.
- faa7969: Server guards: CORS for `trustedOrigins` (preflight and response headers, never `*`; `crossOrigin` for other transports), rate limits for exposed `public` operations over HTTP (`createServer(config, { rateLimit })`, 120 a minute per client by default, 429 with `Retry-After`, replaceable store), and `server.system(name, { organizationId, permissions })`, the principal for jobs and webhooks that grants exactly the given permissions and never comes from a request. `OperationError` carries `retryAfter`.
- Updated dependencies [e4e9440]
- Updated dependencies [a8f1ce8]
- Updated dependencies [636efcb]
- Updated dependencies [d113780]
- Updated dependencies [ab106bc]
- Updated dependencies [faa7969]
- Updated dependencies [70d0d5c]
  - @bitakit/core@0.3.3
