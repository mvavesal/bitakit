import { createRuntime, type BitaKitRuntime } from '../runtime.js';
import { serverStartHooks } from '../runtime-mode.js';
import { getService } from '../service-key.js';
import { isOperationError, OperationError } from '../operation-error.js';
import { organizationHeader } from '../remote.js';
import {
  requestContext,
  type OrganizationContext,
  type PublicContext,
  type RequestContextProvider,
} from '../request-context.js';
import { bindSettings } from '../settings/server.js';
import { isThenable } from '../schema.js';
import { normalizeIdentity, permissionCheck, type Identity } from './access.js';
import { compileOperations, label, linkOperations, type Operation } from './compile.js';
import type {
  CallOptions,
  OperationInfo,
  ServerConfig,
  ServerOptions,
  ServerServices,
} from './types.js';
import { check, type Checked } from './validate.js';

/** One caller's request and its identity, resolved at most once (memoized promise). */
export type CallerState = { readonly request: Request; identity?: Promise<Identity> };
export type KernelCallOptions = CallOptions & { exposedOnly: boolean };

const notFound = () => new OperationError('NOT_FOUND', 'Operation not found.');
const unavailable = (requestId: string) =>
  new OperationError(
    'SERVICE_UNAVAILABLE',
    `The server is not available. Reference: ${requestId}`,
    {
      requestId,
    },
  );
const internal = (requestId: string) =>
  new OperationError('INTERNAL_SERVER_ERROR', `Something went wrong. Reference: ${requestId}`, {
    requestId,
  });
const newRequestId = () => globalThis.crypto.randomUUID();

/**
 * One booted composition: a server-mode runtime plus the compiled operation table. Boots once,
 * lazily; a failed boot stays failed (every call answers SERVICE_UNAVAILABLE) until a new kernel
 * replaces it. Calls share no mutable state except the in-flight counter `stop()` drains.
 */
export class Kernel {
  readonly ready: Promise<void>;
  private state: 'booting' | 'ready' | 'failed' = 'booting';
  private closing = false;
  private stopCompletion?: Promise<void>;
  private runtime?: BitaKitRuntime;
  private operations = new Map<string, Operation>();
  private folded = new Map<string, Operation>();
  private provider?: RequestContextProvider;
  private services!: ServerServices;
  private inflight = 0;
  private drained?: () => void;

  constructor(
    private readonly config: ServerConfig,
    private readonly options: ServerOptions,
  ) {
    this.ready = this.boot();
    this.ready.catch(() => {});
  }

  private async boot(): Promise<void> {
    try {
      const plugins = [...(this.config.plugins ?? []), ...(this.options.plugins ?? [])];
      const runtime = createRuntime(
        { ...this.config, plugins },
        { services: this.options.services, mode: 'server' },
      );
      this.runtime = runtime;
      const appId = this.config.appId ?? 'app';
      const providers = [
        ...Object.keys(this.options.services ?? {}),
        ...runtime.modules.flatMap((module) =>
          module.services.flatMap((service) => [service.id, service.provides, service.exposeAs]),
        ),
      ].filter((name) => name === requestContext);
      const table = compileOperations(runtime.modules, plugins, appId, {
        providers,
        operations: this.options.operations,
      });
      serverStartHooks.set(runtime, (parts) => linkOperations(table, parts));
      runtime.mount();
      await runtime.ready;
      this.operations = new Map(table.exact);
      this.folded = new Map(table.folded);
      this.services = runtime.services as unknown as ServerServices;
      if (runtime.hasService(requestContext))
        this.provider = getService(runtime.services as object, requestContext);
      this.state = 'ready';
    } catch (error) {
      this.state = 'failed';
      console.error('[bitakit] The server failed to start.', error);
      await this.runtime?.stop().catch(() => {});
      throw error;
    }
  }

  /** Runs one operation through the per-call order (access, input, interceptors, execute, output). */
  async call(
    id: string,
    input: unknown,
    caller: CallerState,
    options: KernelCallOptions,
  ): Promise<unknown> {
    if (this.state === 'booting') await this.ready.catch(() => {});
    const requestId = options.requestId ?? newRequestId();
    if (this.state === 'failed') {
      console.error(
        `[bitakit] The server is not available (reference ${requestId}); its startup failed, see the error logged at boot.`,
      );
      throw unavailable(requestId);
    }
    if (this.closing) throw unavailable(requestId);
    const operation = options.exposedOnly
      ? this.operations.get(id)
      : (this.operations.get(id) ?? this.folded.get(id.toLowerCase()));
    if (!operation || (options.exposedOnly && !operation.exposed)) throw notFound();
    this.inflight++;
    try {
      return await this.run(operation, input, caller, options, requestId);
    } finally {
      if (--this.inflight === 0) this.drained?.();
    }
  }

  private async run(
    operation: Operation,
    input: unknown,
    caller: CallerState,
    options: KernelCallOptions,
    requestId: string,
  ): Promise<unknown> {
    const signal = options.signal ?? caller.request.signal;
    const ctx =
      operation.access === 'public'
        ? Object.freeze({ requestId, signal } satisfies PublicContext)
        : await this.authorize(operation, caller, options, requestId, signal);
    let value = input;
    if (operation.input) {
      let checked = check(operation.input, input);
      if (isThenable(checked)) checked = await checked;
      if (!checked.ok) throw refused(operation, 'input', checked, requestId);
      value = checked.value;
    } else if (input !== undefined)
      throw new OperationError('BAD_REQUEST', 'This operation takes no input.');
    const services = this.services;
    // Frozen: an interceptor cannot change what later interceptors, observers or execute see.
    const hook = Object.freeze({
      id: operation.id,
      input: value,
      ctx,
      services,
      config: operation.config,
      signal,
    });
    try {
      for (const { run } of operation.before) {
        let verdict = run(hook);
        if (isThenable(verdict)) verdict = await verdict;
        if (verdict === false)
          throw new OperationError('FORBIDDEN', 'This action is not allowed.', {
            reason: 'INTERCEPTED',
          });
      }
      let events: unknown;
      let settings: unknown;
      const runtime = this.runtime!;
      let result = operation.execute({
        id: operation.id,
        input: value,
        ctx,
        services,
        config: operation.config,
        signal,
        get events() {
          return (events ??= operation.events.withContext(ctx));
        },
        get settings() {
          return (settings ??= bindSettings(runtime.settingsAccess, ctx));
        },
      });
      if (isThenable(result)) result = await result;
      if (operation.output) {
        let checked = check(operation.output, result);
        if (isThenable(checked)) checked = await checked;
        if (!checked.ok) throw refused(operation, 'output', checked, requestId);
        result = checked.value;
      }
      if (operation.after.length) {
        const context = Object.freeze({ ...hook, result });
        for (const { run, module } of operation.after) observe(() => run(context), module);
      }
      return result;
    } catch (error) {
      if (operation.onError.length) {
        const context = Object.freeze({ ...hook, error });
        for (const { run, module } of operation.onError) observe(() => run(context), module);
      }
      if (isOperationError(error)) throw error;
      console.error(`[bitakit] ${label(operation.id)} failed (reference ${requestId}).`, error);
      throw internal(requestId);
    }
  }

  /** Step 3: identity, organization, stale-organization and permission checks. */
  private async authorize(
    operation: Operation,
    caller: CallerState,
    options: KernelCallOptions,
    requestId: string,
    signal: AbortSignal,
  ): Promise<PublicContext> {
    let identity: Identity;
    try {
      identity = await (caller.identity ??= Promise.resolve()
        .then(() => this.provider!.resolve(caller.request))
        .then(normalizeIdentity));
    } catch (error) {
      console.error(
        `[bitakit] The requestContext provider failed for ${label(operation.id)} (reference ${requestId}).`,
        error,
      );
      throw internal(requestId);
    }
    const { user, organization } = identity;
    if (!user) throw new OperationError('UNAUTHORIZED', 'Sign in to continue.');
    if (!operation.organization) return Object.freeze({ requestId, signal, user });
    if (!organization)
      throw identity.reason === 'NOT_A_MEMBER'
        ? new OperationError('FORBIDDEN', 'You are not a member of this organization.', {
            reason: 'NOT_A_MEMBER',
          })
        : new OperationError('FORBIDDEN', 'Choose an organization to continue.', {
            reason: 'NO_ACTIVE_ORGANIZATION',
          });
    const header = caller.request.headers.get(organizationHeader);
    const expected =
      options.organizationId !== undefined ? (options.organizationId ?? '') : (header ?? undefined);
    if (expected !== undefined && expected !== organization.id)
      throw new OperationError(
        'CONFLICT',
        'The active organization changed. Reload and try again.',
        { reason: 'ORGANIZATION_CHANGED' },
      );
    const ctx: OrganizationContext = Object.freeze({
      requestId,
      signal,
      user,
      organization,
      member: identity.member,
      can: permissionCheck(identity, (error) =>
        console.error(
          `[bitakit] The permission check failed for ${label(operation.id)} (reference ${requestId}).`,
          error,
        ),
      ),
    });
    if (operation.permission && (await ctx.can(operation.permission)) !== true)
      throw new OperationError('FORBIDDEN', 'You do not have permission for this action.', {
        reason: 'PERMISSION',
      });
    return ctx;
  }

  /**
   * The compiled operations; rejects with the startup error after a failed boot and with
   * SERVICE_UNAVAILABLE once stopping.
   */
  async list(): Promise<readonly OperationInfo[]> {
    await this.ready;
    if (this.closing)
      throw new OperationError('SERVICE_UNAVAILABLE', 'The server is not available.');
    return [...this.operations.values()].map((operation) => operation.info);
  }

  /** Refuses new calls, waits for boot and in-flight calls, then stops the runtime. */
  stop(): Promise<void> {
    this.closing = true;
    return (this.stopCompletion ??= (async () => {
      await this.ready.catch(() => {});
      if (this.inflight > 0) await new Promise<void>((resolve) => (this.drained = resolve));
      await this.runtime?.stop();
    })());
  }
}

/**
 * The error of a failed check. A failing schema (`fault`) and an output the schema rejects are
 * server errors: logged with the reference, answered INTERNAL_SERVER_ERROR. Invalid input is
 * BAD_REQUEST with its issues; when a `parse` threw without issues, its error is logged and only
 * the fixed issue text and the reference are sent.
 */
function refused(
  operation: Operation,
  schema: 'input' | 'output',
  checked: Exclude<Checked, { ok: true }>,
  requestId: string,
): OperationError {
  if ('fault' in checked) {
    console.error(
      `[bitakit] The ${schema} schema of ${label(operation.id)} failed (reference ${requestId}).`,
      checked.fault,
    );
    return internal(requestId);
  }
  if (schema === 'output') {
    console.error(
      `[bitakit] ${label(operation.id)} returned a value its output schema rejects (reference ${requestId}).`,
      'cause' in checked ? checked.cause : checked.issues,
    );
    return internal(requestId);
  }
  if (!('cause' in checked))
    return new OperationError('BAD_REQUEST', 'Invalid input.', { issues: checked.issues });
  console.warn(
    `[bitakit] The input schema of ${label(operation.id)} threw without issues; the caller sees "Invalid value." (reference ${requestId}).`,
    checked.cause,
  );
  return new OperationError('BAD_REQUEST', 'Invalid input.', { issues: checked.issues, requestId });
}

/** `after` and `onError` observe: never awaited, their failures only logged. */
function observe(run: () => unknown, module: string) {
  const report = (error: unknown) =>
    console.error(`[bitakit] A server interceptor of "${module}" failed.`, error);
  try {
    const result = run();
    if (isThenable(result)) Promise.resolve(result).catch(report);
  } catch (error) {
    report(error);
  }
}
