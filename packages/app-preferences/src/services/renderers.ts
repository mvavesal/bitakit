import type { ComponentType } from 'react';
import { scopeModule, serviceKey, type PluginScope } from '@bitakit/core';
import type { AppPreferences } from '../app-preferences.js';
import type { Setting } from '../fields/setting.js';
import type { Registration, SettingType } from '../types.js';
import {
  SettingsRendererRegistry,
  type RendererOwner,
  type SettingsRendererSet,
  type SettingsViewPart,
} from '../renderers/registry.js';
import { builtInRenderers } from '../renderers/defaults.js';
import type {
  SettingControlProps,
  TypeControlProps,
  SettingsSectionRendererProps,
  SettingsViewPropsMap,
} from '../renderers/types.js';
import { normalizeRendererSet } from '../foundation/normalize.js';

/** The application-scoped renderer service. Rendering reads snapshots; registration is scoped. */
export class SettingsRendererService {
  private registry: SettingsRendererRegistry;
  constructor(defaults: SettingsRendererSet = builtInRenderers) {
    this.registry = new SettingsRendererRegistry(defaults);
  }
  getSnapshot = () => this.registry.getSnapshot();
  subscribe = (listener: () => void) => this.registry.subscribe(listener);
  /** Used by the declarative installer; layer and owner come from the contributing module. */
  install(set: SettingsRendererSet, owner: RendererOwner): Registration {
    return this.registry.registerSet(set, owner);
  }
  /**
   * Imperative registration for `setup`. The layer and owner are derived from the runtime-issued
   * scope, so plugins cannot register as the application. Registrations end with the scope.
   */
  scoped(scope: PluginScope) {
    const module = scopeModule(scope);
    const owner: RendererOwner = {
      layer: module.app ? 'app' : 'plugin',
      owner: module.id,
      origin: `setup of "${module.id}"`,
    };
    const own = (registration: Registration) => {
      scope.own(registration.remove);
      return registration;
    };
    return {
      registerField: <S extends Setting<any>>(
        setting: S,
        renderer: { component: ComponentType<SettingControlProps<S>>; group?: boolean },
      ) => own(this.registry.register({ kind: 'field', setting, ...renderer }, owner)),
      registerType: <K extends SettingType>(
        type: K,
        renderer: {
          component: ComponentType<TypeControlProps<K>>;
          variant?: string;
          group?: boolean;
        },
      ) => own(this.registry.register({ kind: 'type', type, ...renderer }, owner)),
      registerSection: (
        section: string,
        renderer: { component: ComponentType<SettingsSectionRendererProps> },
      ) => own(this.registry.register({ kind: 'section', section, ...renderer }, owner)),
      registerView: <P extends SettingsViewPart>(
        part: P,
        renderer: { component: ComponentType<SettingsViewPropsMap[P]> },
      ) => own(this.registry.register({ kind: 'view', part, ...renderer }, owner)),
      register: (set: SettingsRendererSet) =>
        own(this.registry.registerSet(normalizeRendererSet(set, owner.origin!), owner)),
    };
  }
}
export const settingsService = serviceKey<AppPreferences>('settings');
export const settingsRendererService = serviceKey<SettingsRendererService>('settings.renderer');
