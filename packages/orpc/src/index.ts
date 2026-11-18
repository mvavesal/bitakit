import { os, ORPCError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIGenerator, type ConditionalSchemaConverter } from '@orpc/openapi';
import {
  OperationError,
  crossOrigin,
  type FetchHandlerOptions,
  type JsonSchema,
  type OperationInfo,
} from '@bitakit/core/server';

/**
 * `@bitakit/orpc`: an oRPC transport over a BitaKit server's operations. The operations stay the one
 * source; this package only describes them to oRPC and calls them through `server.call(…, { exposedOnly })`,
 * so the same access checks, input validation and interceptors hold and private operations are unreachable.
 * Plugins never change for it.
 */

/** What this package needs of a BitaKit server (`createServer(…)` or the generated `server`). */
export type OperationsServer = {
  operations(): Promise<readonly OperationInfo[]>;
  call(
    id: string,
    input: unknown,
    request: Request,
    options?: { exposedOnly?: boolean },
  ): Promise<unknown>;
};

/** The oRPC context of every procedure: the request the call came with (its headers carry who calls). */
export type BitaKitORPCContext = { request: Request };

const vendor = 'bitakit';
/**
 * A Standard Schema that passes every value through – the kernel validates – and carries the
 * operation's JSON Schema for documents.
 */
function described(jsonSchema: JsonSchema | undefined) {
  return {
    '~standard': { version: 1 as const, vendor, validate: (value: unknown) => ({ value }) },
    jsonSchema,
  };
}
/** Hands oRPC's OpenAPI generator the JSON Schema each operation described of itself. */
export const operationSchemaConverter: ConditionalSchemaConverter = {
  condition: (schema) =>
    (schema as { '~standard'?: { vendor?: string } } | undefined)?.['~standard']?.vendor === vendor,
  convert: (schema) => {
    const json = (schema as { jsonSchema?: JsonSchema }).jsonSchema;
    return json ? [true, { ...json }] : [false, {}];
  },
};

/** A BitaKit failure as oRPC's error: the same code, status and message; nothing else leaves. */
function asORPCError(error: unknown): unknown {
  if (!(error instanceof OperationError)) return error;
  const { reason, issues } = error as OperationError & { reason?: string; issues?: unknown };
  return new ORPCError(error.code, {
    status: error.status,
    message: error.message,
    ...(reason !== undefined || issues !== undefined ? { data: { reason, issues } } : {}),
  });
}

/** The REST path of an operation: `todos.add` → `/todos/add`. */
const pathOf = (id: string) => `/${id.split('.').join('/')}`;

/**
 * The oRPC router of a server's exposed operations, nested like their IDs (`router.todos.add`). A
 * `query` answers GET in the OpenAPI handler; everything else POST. Built from `server.operations()`,
 * which boots the server.
 */
export async function orpcRouter(server: OperationsServer): Promise<Record<string, unknown>> {
  const router: Record<string, unknown> = {};
  for (const operation of await server.operations()) {
    if (!operation.exposed) continue;
    const procedure = os
      .$context<BitaKitORPCContext>()
      .route({
        method: operation.type === 'query' ? 'GET' : 'POST',
        path: pathOf(operation.id) as `/${string}`,
        operationId: operation.id,
        ...(operation.title ? { summary: operation.title } : {}),
        ...(operation.description ? { description: operation.description } : {}),
        tags: [operation.plugin],
      })
      .input(described(operation.input))
      .output(described(operation.output))
      .handler(async ({ input, context }) => {
        try {
          return await server.call(operation.id, input, context.request, { exposedOnly: true });
        } catch (error) {
          throw asORPCError(error);
        }
      });
    let level = router;
    const segments = operation.id.split('.');
    for (const segment of segments.slice(0, -1))
      level = (level[segment] ??= {}) as Record<string, unknown>;
    level[segments.at(-1)!] = procedure;
  }
  return router;
}

export type ORPCHandlerOptions = Pick<FetchHandlerOptions, 'trustedOrigins' | 'origin'> & {
  /** Where the handler is mounted, e.g. `/api/orpc` (RPC) or `/api` (OpenAPI). */
  prefix: `/${string}`;
  /** `rpc` (default): oRPC's own protocol for the oRPC client; `openapi`: plain REST under the prefix. */
  protocol?: 'rpc' | 'openapi';
};

/**
 * A fetch handler for one oRPC protocol over the server's exposed operations:
 * `(request) => Promise<Response>`, 404 for paths outside the prefix. Browser requests follow the
 * same Origin rule and CORS as `fetchHandler` (`crossOrigin`); calls from other sites answer 403 before any
 * operation runs. The router is built on the first request.
 */
export function orpcHandler(
  server: OperationsServer,
  options: ORPCHandlerOptions,
): (request: Request) => Promise<Response> {
  const policy = crossOrigin(options, 'orpcHandler');
  const protocol = options.protocol ?? 'rpc';
  let handler:
    | Promise<RPCHandler<BitaKitORPCContext> | OpenAPIHandler<BitaKitORPCContext>>
    | undefined;
  const create = async () => {
    const router = (await orpcRouter(server)) as never;
    return protocol === 'openapi'
      ? new OpenAPIHandler<BitaKitORPCContext>(router)
      : new RPCHandler<BitaKitORPCContext>(router);
  };
  const handle = async (request: Request): Promise<Response> => {
    const preflight = policy.preflight(request, 'GET, POST');
    if (preflight) return preflight;
    if (!policy.allowed(request))
      return Response.json(
        { code: 'FORBIDDEN', status: 403, message: 'Cross-origin requests are not allowed.' },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      );
    handler ??= create();
    const { matched, response } = await (
      await handler
    ).handle(request, {
      prefix: options.prefix,
      context: { request },
    });
    return matched
      ? response
      : Response.json({ code: 'NOT_FOUND', status: 404, message: 'Not found.' }, { status: 404 });
  };
  // Trusted origins (CORS) may read the answer; nobody else's browser gets these headers.
  return async (request) => {
    const response = await handle(request);
    const cors = request.method === 'OPTIONS' ? undefined : policy.headers(request);
    if (!cors) return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(cors)) headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

export type OpenAPIDocumentOptions = {
  /** Where the OpenAPI handler is mounted; the document's server URL. */
  prefix: `/${string}`;
  /** The document's `info`; title and version default to the app's name and `1.0.0`. */
  info?: { title?: string; version?: string; description?: string };
};

/**
 * The OpenAPI 3.1 document of the exposed operations, as `orpcHandler(…, { protocol: 'openapi' })`
 * serves them: paths from the IDs, GET for queries, request and response bodies from the
 * operations' JSON Schemas (absent: any).
 */
export async function openapiDocument(server: OperationsServer, options: OpenAPIDocumentOptions) {
  const generator = new OpenAPIGenerator({ schemaConverters: [operationSchemaConverter] });
  return generator.generate((await orpcRouter(server)) as never, {
    info: {
      title: options.info?.title ?? 'API',
      version: options.info?.version ?? '1.0.0',
      ...(options.info?.description ? { description: options.info.description } : {}),
    },
    servers: [{ url: options.prefix }],
  });
}
