# @bitakit/orpc — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/orpc`).
> To change the package itself, follow the repository's own AGENTS.md instead.

An oRPC transport over a BitaKit server's operations (`server/actions/`), next to the built-in
`fetchHandler`. Server only. Plugins do not change for it: every request goes through
`server.call(id, input, request, { exposedOnly: true })`, so access, input validation and
interceptors hold and private operations are unreachable.

## Use it

```ts
// app/api/orpc/[...path]/route.ts (Next.js) – the RPC protocol for oRPC clients
import { orpcHandler } from '@bitakit/orpc';
import { server } from '@/bitakit.gen.server';

const handle = orpcHandler(server, { prefix: '/api/orpc' });
export { handle as GET, handle as POST };
```

```ts
// REST for third parties, with its OpenAPI 3.1 document
import { openapiDocument, orpcHandler } from '@bitakit/orpc';

export const rest = orpcHandler(server, { prefix: '/api/rest', protocol: 'openapi' });
export const spec = () =>
  openapiDocument(server, { prefix: '/api/rest', info: { title: 'Todos' } });
```

| Export                                                                 | What it does                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `orpcHandler(server, { prefix, protocol?, origin?, trustedOrigins? })` | `(request) => Promise<Response>`; `rpc` (default) or `openapi`; the same Origin rule as `fetchHandler` |
| `orpcRouter(server)`                                                   | The oRPC router of the exposed operations, nested like their IDs                                       |
| `openapiDocument(server, { prefix, info? })`                           | The OpenAPI 3.1 document from the operations' JSON Schemas                                             |
| `operationSchemaConverter`                                             | For your own `OpenAPIGenerator`                                                                        |

- A `query` operation (`type: 'query'`) answers GET in the OpenAPI protocol; its query
  parameters arrive as strings, so give its input schema coercion (`z.coerce.number()`).
- Errors keep BitaKit's code, status and message (`reason` and `issues` as `data`); other errors
  become oRPC's generic 500 without their message.
- Input and output schemas are documented when they implement Standard JSON Schema (zod 4);
  others appear as "any".
- oRPC is pinned to one version; upgrade it here, never in the app.
