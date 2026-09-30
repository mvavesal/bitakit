'use client';
import {
  getService,
  provideService,
  scopeModule,
  type Plugin,
  type PluginScope,
  type Services,
} from '@bitakit/core';
import { bindSettingsNavigation } from './foundation/navigation.js';
import { createSettingsAccess } from './foundation/app-access.js';
import { createAppPreferences, type AppPreferences } from './app-preferences.js';
import { createLocalStorage } from './storage.js';
import type { SettingsSource } from './fields/builders.js';
import { SettingsSection } from './catalog/section.js';
import type { Registration } from './types.js';
import type { SettingsRendererSet } from './renderers/registry.js';
import { builtInRenderers } from './renderers/defaults.js';
import { defaultSettingsMessages, type SettingsMessages } from './react/messages.js';
import {
  SettingsRendererService,
  settingsService,
  settingsRendererService,
} from './services/renderers.js';
import { createBridge } from './providers/foundation.js';
import { ownedSection } from './foundation/ownership.js';
import { originOf } from './foundation/origins.js';

declare module '@bitakit/core' {
  interface ContributionMap {
    settings: SettingsSource;
    'settings.sections': SettingsSection;
    'settings.renderers': SettingsRendererSet;
  }
}

function register<T>(values: readonly T[], add: (value: T) => Registration) {
  const registrations: Registration[] = [];
  try {
    for (const value of values) registrations.push(add(value));
  } catch (error) {
    registrations.reverse().forEach((registration) => registration.remove());
    throw error;
  }
  return () => registrations.reverse().forEach((registration) => registration.remove());
}
/** Imperative data registration for `setup`, owned by the calling module's scope. */
export function scopedSettings(scope: PluginScope, services: Services) {
  const { id } = scopeModule(scope);
  const settings = getService(services, settingsService);
  return {
    register(source: SettingsSource | readonly SettingsSource[]) {
      const registration = settings.register(source, { owner: id, origin: `setup of "${id}"` });
      scope.own(registration.remove);
      return registration;
    },
    addSection(section: SettingsSection) {
      const registration = settings.add(ownedSection(section, id, `setup of "${id}"`));
      scope.own(registration.remove);
      return registration;
    },
  };
}

export type AppPreferencesPluginOptions = {
  settings?: AppPreferences;
  /** Registers `settings` as a service. Disable when the host passes it to FoundationProvider. */
  provideSettings?: boolean;
  messages?: Partial<SettingsMessages>;
  /** Built-in layer. Defaults to the standard controls. */
  defaults?: SettingsRendererSet;
};
/**
 * Foundation integration: typed services, declarative installers for `settings`,
 * `settings.sections` and `settings.renderers`, and the pre-mount rendering bridge.
 */
export function appPreferencesPlugin(options: AppPreferencesPluginOptions = {}): Plugin & {
  publicServices: { preferences: typeof settingsService };
} {
  const preferences =
    options.settings ??
    createAppPreferences({ storage: createLocalStorage({ prefix: 'foundation.settings.' }) });
  const messages = Object.freeze({ ...defaultSettingsMessages, ...options.messages });
  return {
    id: 'app-preferences',
    setup: ({ app, services }) => bindSettingsNavigation(app, getService(services, settingsService), services.i18n),
    appExtensions: { settings: (runtime) => createSettingsAccess(runtime, () => preferences) },
    publicServices: { preferences: settingsService },
    metadata: {
      name: 'App Preferences',
      description: 'Application preferences and their rendering.',
    },
    services: [
      ...(options.provideSettings === false
        ? []
        : [provideService(settingsService, { create: () => preferences })]),
      provideService(settingsRendererService, {
        create: () => new SettingsRendererService(options.defaults ?? builtInRenderers),
      }),
    ],
    providers: [
      {
        id: 'settings.ui',
        component: createBridge(messages, options.defaults ?? builtInRenderers, preferences),
      },
    ],
    installs: {
      settings: (values, { module, services }) => {
        const settings = getService(services, settingsService);
        return register(values, (value) =>
          settings.register(value, { owner: module, origin: originOf(value, `"${module}"`) }),
        );
      },
      'settings.sections': (values, { module, services }) => {
        const settings = getService(services, settingsService);
        return register(values, (section) =>
          settings.add(ownedSection(section, module, originOf(section, `"${module}"`))),
        );
      },
      'settings.renderers': (values, { module, app, services }) => {
        const renderers = getService(services, settingsRendererService);
        return register(values, (set) =>
          renderers.install(set, {
            layer: app ? 'app' : 'plugin',
            owner: module,
            origin: originOf(set, `"${module}"`),
          }),
        );
      },
    },
  };
}
