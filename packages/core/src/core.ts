export {
  defineService,
  defineAction,
  definePlugin,
  isActionSpec,
  isServiceDefinition,
} from './definitions.js';
export type * from './definitions.js';
export { defineEvents, event, isEventsDefinition } from './events/define.js';
export type { EventsDefinition, EventSpec, EventsOf, CancelableOf } from './events/define.js';
export type * from './events/types.js';
export { EventService } from './events/service.js';
export { defineInterceptor, matchesTarget, isServiceInterceptor } from './interceptors/define.js';
export type * from './interceptors/define.js';
export {
  ConfigService,
  ConfigScope,
  defineConfig,
  isConfigDefinition,
  type ConfigContext,
  type ConfigValues,
  type ConfigDefinition,
  type ConfigSchema,
  type ConfigMap,
  type ConfigPath,
  type ConfigAt,
} from './config-service.js';
export { createStore, isStore, type Store } from './store.js';
export { serviceKey, defineContract, getService, type ServiceKey } from './service-key.js';
export type {
  FoundationApp,
  AppExtensionMap,
  Namespace,
  PublicServiceMap,
  PublicServicesOf,
} from './app/types.js';
export { FoundationServiceError } from './app/service-error.js';
export { resolveFoundationConfig, type FoundationOverrides } from './configuration.js';
export {
  FoundationRuntime,
  createRuntime,
  type DialogState,
  type NormalizedPlugin,
} from './runtime.js';
export { FoundationStartupError, isFoundationStartupError } from './startup-error.js';
export {
  PluginScope,
  scopeModule,
  scopePlugins,
  type ComposedPlugin,
  type ScopeModule,
} from './scope.js';
export { mergePluginMessages } from './messages.js';
export { resolveContribution, fallbackTitle } from './conventions.js';
export { ConfirmationController, type Confirmation } from './confirmation.js';
export * from './contracts.js';
export { resolveText, createTranslationPlugin } from './translation.js';
export {
  findPluginPage,
  validatePluginPages,
  pluginPage,
  pluginSlot,
  pluginProvider,
} from './pages.js';
export { destinationMetadata, type Destination, type DestinationKind } from './destinations.js';
export * from './actions/core.js';
export { pluginMetadata } from './metadata.js';
export * from './discovered.js';
export type { PresentationTypes, PresentationType, SlotMap, SlotName } from './presentation.js';
export {
  configureAuthPaths,
  resolveAuthReturnTo,
  authSignInHref,
  type AuthPaths,
  type AuthSignInOptions,
} from './auth-navigation.js';
// Deprecated helpers, removed after the optional packages are migrated (Phase 5).
export {
  provideService,
  defineURLAction,
  defineDialogAction,
  definePage,
  defineView,
  defineSetup,
  defineServiceInterceptor,
} from './compat.js';
