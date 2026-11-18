/**
 * `@bitakit/core/server`: the server half of a BitaKit app. Server-only; never import it from
 * browser code. The `define*` helpers are the root entry's functions with server types.
 */
export { defineAction, defineService, defineInterceptor } from './define.js';
export { definePlugin } from '../definitions.js';
export { defineEvents, event } from '../events/define.js';
export { defineSettings, setting } from '../settings/define.js';
export { defineContract, getService } from '../service-key.js';
export { definePermissions } from '../permissions.js';
export { settingsStorage } from '../settings/storage.js';
export { withPluginOrigin } from '../inspection/plugin-origin.js';
export { BitaKitStartupError, isBitaKitStartupError } from '../startup-error.js';
// The discover* normalizers, expandContributions and the Discovered*Entry types, for the
// generated server file.
export * from '../discovered.js';
export {
  OperationError,
  isOperationError,
  type OperationErrorCode,
  type OperationErrorReason,
  type OperationIssue,
} from '../operation-error.js';
export {
  requestContext,
  type RequestContextProvider,
  type RequestIdentity,
  type RequestUser,
  type RequestMember,
  type PublicContext,
  type UserContext,
  type OrganizationContext,
  type RequestContext,
  type ContextFor,
  type Access,
  type PermissionRequest,
} from '../request-context.js';
export { createServer } from './create-server.js';
export { fetchHandler, type FetchHandlerOptions } from './fetch-handler.js';
export { contributionsOf } from './contributions.js';
export type {
  Server,
  ServerConfig,
  ServerOptions,
  Caller,
  CallOptions,
  OperationInfo,
  OperationType,
  JsonSchema,
  ServerActionEntry,
  ServerActionSpec,
  ServerActionSpecInput,
  ServerExecuteContext,
  ServerServiceContext,
  ServerServices,
  ServerInterceptorSpec,
  ServerInterceptorContext,
  ClientOnlyActionField,
} from './types.js';
export type { ServerActionMap, ServerServiceMap } from '../remote.js';
export type { ServerSettingHandle, ServerSettingsAccess } from '../settings/server.js';
