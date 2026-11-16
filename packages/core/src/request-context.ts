import { defineContract } from './service-key.js';
import type { PermissionMap } from './permissions.js';

/**
 * Operations to check with `access: { permission }`: resources and their operations, typed against
 * the generated permission catalog when one exists.
 */
export type PermissionRequest = keyof PermissionMap extends never
  ? Readonly<Record<string, readonly string[]>>
  : { readonly [Resource in keyof PermissionMap]?: readonly PermissionMap[Resource][] };
/** Who may call a server Action. Required on every server Action. */
export type Access =
  | 'public'
  | 'user'
  | 'organization'
  | { readonly permission: PermissionRequest };

export type RequestUser = {
  readonly id: string;
  readonly name?: string;
  readonly email?: string;
} & Readonly<Record<string, unknown>>;
export type RequestMember = {
  readonly id?: string;
  readonly role?: string | readonly string[];
} & Readonly<Record<string, unknown>>;
/** What a `requestContext` provider answers for one request; the kernel normalizes it. */
export type RequestIdentity = {
  user: RequestUser | null;
  /** Only for an active, non-disabled membership; never just an active organization ID. */
  organization?: { id: string } | null;
  member?: RequestMember | null;
  reason?: 'NO_ACTIVE_ORGANIZATION' | 'NOT_A_MEMBER';
  /** For `access: { permission }`. Only a result `=== true` grants. May be async. */
  can?(permission: PermissionRequest): boolean | Promise<boolean>;
};
/**
 * Resolves the verified identity of a request. One app service provides it
 * (`provides: requestContext`, usually `src/server/services/request-context.ts`); `resolve`
 * receives the same `Request` object that was passed to `server.as()` or `server.call()`.
 */
export type RequestContextProvider = {
  resolve(request: Request): RequestIdentity | Promise<RequestIdentity>;
};
export const requestContext = defineContract('requestContext').of<RequestContextProvider>();

/** What every operation receives as `ctx`. Frozen. */
export type PublicContext = { readonly requestId: string; readonly signal: AbortSignal };
export type UserContext = PublicContext & { readonly user: RequestUser };
export type OrganizationContext = UserContext & {
  readonly organization: { readonly id: string };
  readonly member: RequestMember | null;
  /** True only when the provider's `can` answers exactly `true`; a throw answers false. */
  can(permission: PermissionRequest): Promise<boolean>;
};
/** The `ctx` an operation with access rule `A` receives. */
export type ContextFor<A> = A extends 'public'
  ? PublicContext
  : A extends 'user'
    ? UserContext
    : OrganizationContext;
/** What event listeners and settings receive: whatever the call had. */
export type RequestContext = PublicContext &
  Partial<Omit<OrganizationContext, keyof PublicContext>>;
