export {
  defineService,
  defineAction,
  definePlugin,
  dialogOf,
  isActionSpec,
  isServiceDefinition,
} from './definitions.js';
export type * from './definitions.js';
export { defineEvents, event, isEventsDefinition } from './events/define.js';
export type { EventsDefinition, EventSpec, EventsOf, CancelableOf } from './events/define.js';
export type * from './events/types.js';
export type { GeneratedName } from './names.js';
export { EventService } from './events/service.js';
export {
  defineSettings,
  setting,
  isSettingsDefinition,
  isSettingSpec,
  parseSetting,
} from './settings/define.js';
export type {
  SettingSpec,
  SettingScope,
  SettingControl,
  SettingOption,
  SettingsDefinition,
  SettingsSectionOptions,
  SettingsMap,
  SettingKey,
  SettingValue,
  SettingsOf,
} from './settings/define.js';
export {
  SettingsStore,
  type SettingState,
  type SaveResult,
  type SettingsIdentity,
  type SettingEntry,
} from './settings/store.js';
export {
  settingsStorage,
  settingsOwner,
  createMemorySettingsStorage,
  createLocalSettingsStorage,
  type SettingsStorage,
  type SettingsContext,
  type StoredSetting,
  type SettingsLoadRequest,
  type KeyValueStore,
} from './settings/storage.js';
export {
  createSettingsAccess,
  type SettingsAccess,
  type SettingHandle,
} from './settings/access.js';
export { validateSync, validate, schemaErrorMessage } from './schema.js';
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
export {
  serviceKey,
  defineContract,
  getService,
  type ServiceKey,
  type ContractName,
} from './service-key.js';
export type {
  BitaKitApp,
  AppExtensionMap,
  Namespace,
  PublicServiceMap,
  PublicActionsOf,
  PublicCancelableOf,
  PublicEventsOf,
  PublicServicesOf,
  PublicSettingsOf,
  PublicSlotsOf,
} from './app/types.js';
export { BitaKitServiceError } from './app/service-error.js';
export { resolveBitaKitConfig, type BitaKitOverrides } from './configuration.js';
export {
  BitaKitRuntime,
  createRuntime,
  type DialogState,
  type NormalizedPlugin,
} from './runtime.js';
export { BitaKitStartupError, isBitaKitStartupError } from './startup-error.js';
export type { Cleanup } from './lifecycle/cleanup.js';
export type {
  LifecyclePhase,
  LifecycleFailure,
  LifecycleEntry,
  LifecycleSnapshot,
  LifecycleState,
} from './lifecycle/state.js';
export {
  RuntimeController,
  createRuntimeController,
  describeStartupFailure,
  failedPluginClosure,
  pluginExposesService,
} from './lifecycle/controller.js';
export type {
  FailurePolicy,
  StartupFailure,
  RuntimeControllerSnapshot,
  RuntimeControllerOptions,
} from './lifecycle/controller.js';
export {
  PluginScope,
  scopeModule,
  scopePlugins,
  scopeModules,
  scopeTranslation,
  scopeLifecycle,
  type ComposedPlugin,
  type ComposedModule,
  type ScopeModule,
  type ScopeTranslation,
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
  pluginSettingsPage,
  pluginLayout,
} from './pages.js';
export { destinationMetadata, type Destination, type DestinationKind } from './destinations.js';
export * from './actions/core.js';
export { pluginMetadata } from './metadata.js';
export * from './discovered.js';
export type {
  PresentationTypes,
  PresentationType,
  SlotMap,
  LegacySlotMap,
  SlotName,
} from './presentation.js';
export { defineSlot, isSlotDefinition } from './slots/define.js';
export type * from './slots/define.js';
export type * from './slots/types.js';
export type { ActionSlotPlacement } from './slots/action-placement.js';
export { SlotError } from './slots/runtime.js';
export {
  configureAuthPaths,
  resolveAuthReturnTo,
  authSignInHref,
  type AuthPaths,
  type AuthSignInOptions,
} from './auth-navigation.js';

export type {
  PluginUpdateResult,
  PluginChangeResult,
  PluginDependentOptions,
} from './lifecycle/reconcile.js';

export {
  createInventory,
  inspectRuntime,
  observeRuntimeInventory,
  inventoryMetadata,
} from './inspection/inventory.js';
export type {
  RuntimeInventory,
  InventoryPlugin,
  InventoryDeclaration,
  InventoryMetadata,
  InventoryKind,
  InventoryLive,
} from './inspection/inventory.js';
