# @bitakit/mcp

The operations a BitaKit app chooses, as [MCP](https://modelcontextprotocol.io) tools for AI agents
(Streamable HTTP, stateless). Every call goes through `server.call(…, { exposedOnly: true })` with
its own request, so the app's access rules decide who may do what.

```ts
import { mcpHandler } from '@bitakit/mcp';
import { server } from './bitakit.gen.server';

export const mcp = mcpHandler(server, { tools: ['todos.list', 'todos.add'] });
```

Server only. See `AGENTS.md` for the details.
