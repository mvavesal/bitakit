'use client';
import './types/presentation.js';
export * from '@bitakit/core';
export { FoundationProvider } from './providers/foundation-provider.js';
export {
  defineFramework,
  type Router,
  type Framework,
  type FrameworkDefinition,
  type FrameworkProviderProps,
} from './providers/define-framework.js';
export type { FoundationProviderProps } from './types/provider.js';
export { ActionMenu } from './components/action-menu.js';
export { ActionBoundary } from './components/action-boundary.js';
export { useFoundation } from './providers/foundation-context.js';
export { useFoundationApp } from './hooks/use-foundation-app.js';
export type { FoundationUI, FoundationLabels } from './types/ui.js';
export { PluginSlot, useFoundationReady } from './components/plugin-slot.js';
export { PluginPage, useCurrentPage } from './components/plugin-page.js';
export { useFoundationNavigation } from './hooks/use-foundation-navigation.js';
export { useGroupTitle } from './hooks/use-group-title.js';
export * from './actions/index.js';
// The React binding wins over Core's low-level Action class, which stays available from @bitakit/core.
export { Action } from './components/action.js';
export { usePluginConfig } from './hooks/use-plugin-config.js';
export { useTranslation, type Translate } from './hooks/use-translation.js';
export { useEvent } from './hooks/use-event.js';
export { useService, useServiceState } from './hooks/use-service.js';
export { useSetting, type UseSettingResult } from './hooks/use-setting.js';
export {
  useSettingsCatalog,
  type SettingsCatalogSection,
  type SettingsCatalogField,
  type SettingsCatalogOption,
} from './hooks/use-settings-catalog.js';
export { useSlot, type SlotEntry } from './hooks/use-slot.js';
export { useNavigation, type Navigation } from './hooks/use-navigation.js';
export { useAuth } from './hooks/use-auth.js';
export { AuthBoundary, type AuthBoundaryProps } from './components/auth-boundary.js';
