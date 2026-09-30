import {
  getService,
  type FoundationRuntime,
  type Namespace,
  type DiscoveredFile,
} from '@bitakit/core';
import {
  SettingsCollection,
  SettingsDeclaration,
  settingsOf,
  type FieldSpec,
} from '../fields/builders.js';
import type { Setting } from '../fields/setting.js';
import { createSettingReference, type SettingReference } from '../fields/reference.js';
import { settingsService } from '../services/renderers.js';

export interface PublicSettingsMap {}
type Fields<F> = {
  readonly [K in keyof F]: F[K] extends FieldSpec<infer S> ? SettingReference<S> : never;
};
type Entry<T, Path extends string> =
  T extends SettingsDeclaration<infer F, any>
    ? { [K in Path]: Fields<F> }
    : T extends SettingsCollection<infer F>
      ? T extends { id: infer Id extends string }
        ? { [K in Id]: Fields<F> }
        : {}
      : {};
export type DiscoveredSettingsEntry<File, Module extends string> =
  File extends DiscoveredFile<infer T, infer Path>
    ? Entry<
        T,
        `${Module extends '@foundation/app' ? 'app' : Module}${Path extends '' ? '' : `.${Path}`}`
      >
    : {};
declare module '@bitakit/core' {
  interface AppExtensionMap {
    readonly settings: Namespace<PublicSettingsMap>;
  }
}

/** Builds definition handles before mount; their values remain owned by AppPreferences. */
export function createSettingsAccess(
  runtime: FoundationRuntime,
  initialOwner: () => import('../app-preferences.js').AppPreferences,
) {
  const root = Object.create(null);
  const definitions = new Map<string, Setting<any>>();
  const owner = () =>
    runtime.isReady() ? getService(runtime.services, settingsService) : initialOwner();
  for (const { values } of runtime.contributionsOf('settings')) {
    for (const setting of settingsOf(values)) {
      if (definitions.get(setting.key) === setting) continue;
      definitions.set(setting.key, setting);
      const path = setting.key.split('.');
      let branch = root;
      for (const segment of path.slice(0, -1)) branch = branch[segment] ??= Object.create(null);
      const name = path.at(-1)!;
      if (Object.hasOwn(branch, name))
        throw new Error(`Duplicate public setting "${setting.key}".`);
      branch[name] = createSettingReference(setting as Setting<any>, owner);
    }
  }
  return root;
}
