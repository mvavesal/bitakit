'use client';
import './types/presentation.js';
export * from '@bitakit/core';
export { FoundationProvider } from './providers/foundation-provider.js';
export type { FoundationProviderProps } from './types/provider.js';
export { ActionMenu } from './components/action-menu.js';
export { ActionBoundary } from './components/action-boundary.js';
export { useFoundation } from './providers/foundation-context.js';
export { useFoundationApp } from './hooks/use-foundation-app.js';
export type { FoundationUI, FoundationLabels } from './types/ui.js';
export { PluginSlot, useFoundationReady } from './components/plugin-slot.js';

export { PluginPage } from './components/plugin-page.js';

export * from './actions/index.js';
export { usePluginConfig } from './hooks/use-plugin-config.js';

export { useTranslation, type Translate } from './hooks/use-translation.js';

export { useWatchEvent } from './hooks/use-watch-event.js';

export { useAuth } from './hooks/use-auth.js';
export { AuthBoundary, type AuthBoundaryProps } from './components/auth-boundary.js';
