export * from './definitions.js';
export type {
  FoundationApp,
  AppExtensionMap,
  Namespace,
  PublicServiceKeys,
  PublicServiceMap,
  PublicServicesOf,
} from './app/types.js';
export { FoundationServiceError } from './app/service-error.js';
export { resolveFoundationConfig, type FoundationOverrides } from './configuration.js';
export { FoundationRuntime, createRuntime } from './runtime.js';
export { FoundationStartupError, isFoundationStartupError } from './startup-error.js';
export {
  PluginScope,
  scopeModule,
  scopePlugins,
  type ComposedPlugin,
  type ScopeModule,
} from './scope.js';
export { validateFields } from './validation.js';
export { mergePluginMessages } from './messages.js';
export { resolveContribution } from './conventions.js';

export { ConfirmationController, type Confirmation } from './confirmation.js';

export * from './contracts.js';
export { resolveText, createTranslationPlugin } from './translation.js';

export { findPluginPage, validatePluginPages } from './pages.js';
export { destinationMetadata, type Destination, type DestinationKind } from './destinations.js';

export * from './actions/core.js';
export { serviceKey, getService, provideService, type ServiceKey } from './service-key.js';
export { pluginMetadata } from './metadata.js';

export {
  ConfigService,
  ConfigScope,
  defineConfig,
  type ConfigContext,
  type ConfigValues,
  type ConfigDefinition,
  type ConfigSchema,
  type ConfigMap,
  type ConfigPath,
  type ConfigAt,
} from './config-service.js';
export * from './discovered.js';

export type { PresentationTypes, PresentationType } from './presentation.js';
export type {
  ActionInstance,
  StatefulDefinition,
  StatefulBuilder,
} from './contributions/stateful-action.js';

export { defineServiceInterceptor, type ServiceInterceptor } from './interceptors/service.js';


export type * from './events/types.js';
export type { ActionSetup, ActionSetupContext, SetupAction } from './events/action-setup.js';
export { EventService } from './events/service.js';

export { configureAuthPaths, resolveAuthReturnTo, authSignInHref, type AuthPaths, type AuthSignInOptions } from './auth-navigation.js';
