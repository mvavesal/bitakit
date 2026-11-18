# @bitakit/orpc

An [oRPC](https://orpc.dev) transport over a BitaKit server's operations: the RPC protocol for
oRPC clients, plain REST with an OpenAPI 3.1 document, both from `server.operations()`. Plugins do
not change; every call goes through `server.call(…, { exposedOnly: true })`.

```ts
import { openapiDocument, orpcHandler } from '@bitakit/orpc';
import { server } from './bitakit.gen.server';

export const rpc = orpcHandler(server, { prefix: '/api/orpc' });
export const rest = orpcHandler(server, { prefix: '/api/rest', protocol: 'openapi' });
export const spec = () => openapiDocument(server, { prefix: '/api/rest' });
```

Server only. See `AGENTS.md` for the details.
