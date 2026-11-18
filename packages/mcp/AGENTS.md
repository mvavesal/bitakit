# @bitakit/mcp — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/mcp`).
> To change the package itself, follow the repository's own AGENTS.md instead.

The operations an app chooses, as MCP tools for AI agents (Streamable HTTP, stateless). Server only.
Plugins do not change for it: every tool call goes through
`server.call(id, input, request, { exposedOnly: true })` with the HTTP request it came with.

## Use it

```ts
// app/api/mcp/route.ts (Next.js)
import { mcpHandler } from '@bitakit/mcp';
import { server } from '@/bitakit.gen.server';

const handle = mcpHandler(server, { tools: ['todos.list', 'todos.add'], name: 'todos' });
export { handle as GET, handle as POST, handle as DELETE };
```

- `tools` is required and lists operation IDs; each must be exposed. Never offer every exposed
  operation – an agent gets exactly what you name.
- Who calls is resolved per call by the app's `requestContext` provider from the MCP request's
  headers (a session cookie or bearer token); the operation's `access` decides as for any caller.
- Tool names are the IDs with `_` for dots (`todos_add`); input and output schemas come from the
  operations (zod 4 → JSON Schema); `type: 'query'` marks a tool read-only.
- A BitaKit refusal reaches the agent as `CODE: message` (it can act on it); other errors only as
  "The operation failed."
- Browser requests follow `fetchHandler`'s Origin rule (`origin`, `trustedOrigins`), which also
  stops DNS rebinding. The MCP SDK is pinned to one version; upgrade it here, never in the app.
