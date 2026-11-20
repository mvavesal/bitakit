# @bitakit/mcp

## 0.3.1

### Patch Changes

- 3dd663f: New optional package `@bitakit/mcp`: `mcpHandler(server, { tools })` offers the named, exposed operations as MCP tools (Streamable HTTP, stateless). Each call goes through `server.call(…, { exposedOnly: true })` with its own request, so the app's `requestContext` and the operations' access rules decide; refusals reach the agent as `CODE: message`.
- faa7969: Server guards: CORS for `trustedOrigins` (preflight and response headers, never `*`; `crossOrigin` for other transports), rate limits for exposed `public` operations over HTTP (`createServer(config, { rateLimit })`, 120 a minute per client by default, 429 with `Retry-After`, replaceable store), and `server.system(name, { organizationId, permissions })`, the principal for jobs and webhooks that grants exactly the given permissions and never comes from a request. `OperationError` carries `retryAfter`.
- Updated dependencies [e4e9440]
- Updated dependencies [a8f1ce8]
- Updated dependencies [636efcb]
- Updated dependencies [d113780]
- Updated dependencies [ab106bc]
- Updated dependencies [faa7969]
- Updated dependencies [70d0d5c]
  - @bitakit/core@0.3.3
