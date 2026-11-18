import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  OperationError,
  crossOrigin,
  type FetchHandlerOptions,
  type JsonSchema,
  type OperationInfo,
} from '@bitakit/core/server';

/**
 * `@bitakit/mcp`: a BitaKit server's operations as MCP tools for AI agents. The app names the tools
 * (`tools`), never "every exposed operation"; each call goes through
 * `server.call(id, input, request, { exposedOnly: true })` with the HTTP request it came with, so the
 * caller is resolved per call by the app's `requestContext` provider and access, validation and
 * interceptors hold. Plugins never change for it.
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

export type MCPHandlerOptions = Pick<FetchHandlerOptions, 'trustedOrigins' | 'origin'> & {
  /** The operation IDs offered as tools; each must be exposed. Nothing else is reachable. */
  tools: readonly string[];
  /** How the server introduces itself to MCP clients. */
  name?: string;
  version?: string;
};

type Tool = {
  operation: OperationInfo;
  name: string;
  /** The operation's input is not an object: the tool takes it as `{ input }`. */
  wrapped: boolean;
};

/** A tool name MCP clients accept everywhere: the operation ID with `_` for its dots. */
const toolName = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_');
const isObjectSchema = (schema: JsonSchema | undefined) => !!schema && schema.type === 'object';

async function toolsOf(
  server: OperationsServer,
  ids: readonly string[],
): Promise<Map<string, Tool>> {
  const operations = new Map(
    (await server.operations()).map((operation) => [operation.id, operation]),
  );
  const tools = new Map<string, Tool>();
  for (const id of ids) {
    const operation = operations.get(id);
    if (!operation) throw new Error(`mcpHandler: "${id}" is not an operation of this server.`);
    if (!operation.exposed)
      throw new Error(`mcpHandler: "${id}" is not exposed; only exposed operations can be tools.`);
    const name = toolName(id);
    if (tools.has(name))
      throw new Error(
        `mcpHandler: "${id}" and "${tools.get(name)!.operation.id}" share the tool name "${name}".`,
      );
    tools.set(name, {
      operation,
      name,
      wrapped: !!operation.input && !isObjectSchema(operation.input),
    });
  }
  return tools;
}

/** The MCP description of one tool: its input (and, for object results, output) as JSON Schema. */
function describe({ operation, name, wrapped }: Tool) {
  const { $schema: _input, ...input } = (operation.input ?? {}) as Record<string, unknown>;
  const { $schema: _output, ...output } = (operation.output ?? {}) as Record<string, unknown>;
  return {
    name,
    ...(operation.title ? { title: operation.title } : {}),
    description: operation.description ?? operation.title ?? operation.id,
    inputSchema: wrapped
      ? { type: 'object' as const, properties: { input }, required: ['input'] }
      : isObjectSchema(operation.input)
        ? (input as { type: 'object' })
        : { type: 'object' as const },
    ...(isObjectSchema(operation.output) ? { outputSchema: output as { type: 'object' } } : {}),
    annotations: { readOnlyHint: operation.type === 'query' },
  };
}

/** What the operation receives: `{ input }` unwrapped, no arguments as no input. */
function inputOf(tool: Tool, args: Record<string, unknown> | undefined): unknown {
  if (tool.wrapped) return args?.input;
  return args && Object.keys(args).length ? args : tool.operation.input ? (args ?? {}) : undefined;
}

/**
 * A fetch handler for MCP's Streamable HTTP transport (stateless, JSON responses):
 * `(request) => Promise<Response>`. Browser requests follow `fetchHandler`'s Origin rule, which also
 * stops DNS rebinding; other sites get 403 before any tool runs. The tools are checked on the first
 * request (unknown or private operations stop it with an error).
 */
export function mcpHandler(
  server: OperationsServer,
  options: MCPHandlerOptions,
): (request: Request) => Promise<Response> {
  if (!options.tools.length)
    throw new TypeError('mcpHandler: name at least one operation in tools.');
  const policy = crossOrigin(options, 'mcpHandler');
  let tools: Promise<Map<string, Tool>> | undefined;
  const handle = async (request: Request): Promise<Response> => {
    const preflight = policy.preflight(request, 'GET, POST, DELETE');
    if (preflight) return preflight;
    if (!policy.allowed(request))
      return Response.json(
        {
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Cross-origin requests are not allowed.' },
          id: null,
        },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      );
    tools ??= toolsOf(server, options.tools);
    const known = await tools;
    const mcp = new Server(
      { name: options.name ?? 'bitakit', version: options.version ?? '1.0.0' },
      { capabilities: { tools: {} } },
    );
    mcp.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [...known.values()].map(describe),
    }));
    mcp.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      const tool = known.get(params.name);
      if (!tool)
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Unknown tool "${params.name}".` }],
        };
      try {
        const result = await server.call(
          tool.operation.id,
          inputOf(tool, params.arguments),
          request,
          { exposedOnly: true },
        );
        const structured =
          isObjectSchema(tool.operation.output) &&
          result &&
          typeof result === 'object' &&
          !Array.isArray(result);
        return {
          content: [
            {
              type: 'text' as const,
              text: result === undefined ? 'Done.' : JSON.stringify(result),
            },
          ],
          ...(structured ? { structuredContent: result as Record<string, unknown> } : {}),
        };
      } catch (error) {
        // A refusal is data the agent can act on; anything else stays a generic failure.
        const text =
          error instanceof OperationError
            ? `${error.code}: ${error.message}`
            : 'The operation failed.';
        return { isError: true, content: [{ type: 'text' as const, text }] };
      }
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await mcp.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await mcp.close();
    }
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
