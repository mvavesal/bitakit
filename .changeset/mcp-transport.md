---
'@bitakit/mcp': patch
---

New optional package `@bitakit/mcp`: `mcpHandler(server, { tools })` offers the named, exposed operations as MCP tools (Streamable HTTP, stateless). Each call goes through `server.call(…, { exposedOnly: true })` with its own request, so the app's `requestContext` and the operations' access rules decide; refusals reach the agent as `CODE: message`.
