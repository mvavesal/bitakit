import type { DiscoveredFile } from '@bitakit/core';
import { Setting } from '../fields/setting.js';
import {
  SettingsCollection,
  SettingsDeclaration,
  type SettingsSource,
} from '../fields/builders.js';
import { SettingsSection } from '../catalog/section.js';
import {
  assertRendererDescriptor,
  SettingsConfigurationError,
  type RendererDescriptor,
  type SettingsRendererSet,
} from '../renderers/registry.js';
import { setOrigin } from './origins.js';

const origin = (file: DiscoveredFile, moduleId: string) => `${file.source} (${moduleId})`;
const list = (value: unknown) => (Array.isArray(value) ? value : [value]);
/** `settings/`: default-export defineSettings(...), a definition, or an array of them. */
export function discoverSettings(
  files: readonly DiscoveredFile[],
  moduleId: string,
): SettingsSource[] {
  return files.flatMap((file) =>
    list(file.value).map((value) => {
      if (value instanceof SettingsDeclaration)
        value = value.resolve(
          [moduleId === '@foundation/app' ? 'app' : moduleId, file.path].filter(Boolean).join('.'),
        );
      if (!(value instanceof SettingsCollection || value instanceof Setting))
        throw new SettingsConfigurationError(
          `Invalid settings export in ${origin(file, moduleId)}: default-export defineSettings({ id, fields }) or a setting definition.`,
        );
      return setOrigin(value, origin(file, moduleId));
    }),
  );
}
/** `sections/`: default-export defineSettingsSection(...) or an array of sections. */
export function discoverSettingsSections(
  files: readonly DiscoveredFile[],
  moduleId: string,
): SettingsSection[] {
  return files.flatMap((file) =>
    list(file.value).map((value) => {
      if (!(value instanceof SettingsSection))
        throw new SettingsConfigurationError(
          `Invalid settings section export in ${origin(file, moduleId)}: default-export defineSettingsSection({ id, title, settings }).`,
        );
      return setOrigin(value, origin(file, moduleId));
    }),
  );
}
const setKeys = ['fields', 'types', 'sections', 'views'] as const;
/** Accepts defineSettingsRenderers({...}), one descriptor or an array of descriptors. */
export function normalizeRendererSet(value: unknown, source: string): SettingsRendererSet {
  if (Array.isArray(value) || (value && typeof value === 'object' && 'kind' in value)) {
    const set: Record<(typeof setKeys)[number], RendererDescriptor[]> = {
      fields: [],
      types: [],
      sections: [],
      views: [],
    };
    for (const descriptor of list(value)) {
      assertRendererDescriptor(descriptor, source);
      set[`${descriptor.kind}s` as (typeof setKeys)[number]].push(descriptor);
    }
    return set as SettingsRendererSet;
  }
  if (!value || typeof value !== 'object')
    throw new SettingsConfigurationError(
      `Invalid settings renderer export in ${source}: default-export defineSettingsRenderers({ fields, types, sections, views }).`,
    );
  for (const key of Object.keys(value))
    if (!(setKeys as readonly string[]).includes(key))
      throw new SettingsConfigurationError(
        `Unknown key "${key}" in settings renderers of ${source}; expected ${setKeys.join(', ')}.`,
      );
  const set = value as SettingsRendererSet;
  for (const key of setKeys) {
    const entries = set[key] ?? [];
    if (!Array.isArray(entries))
      throw new SettingsConfigurationError(`"${key}" in ${source} must be an array.`);
    for (const descriptor of entries) {
      assertRendererDescriptor(descriptor, source);
      if (`${descriptor.kind}s` !== key)
        throw new SettingsConfigurationError(
          `A ${descriptor.kind} renderer is listed under "${key}" in ${source}.`,
        );
    }
  }
  return set;
}
/** `renderers/`: declarative renderer files. Ownership and layer come from the contributing module. */
export function discoverSettingsRenderers(
  files: readonly DiscoveredFile[],
  moduleId: string,
): SettingsRendererSet[] {
  return files.map((file) =>
    setOrigin(normalizeRendererSet(file.value, origin(file, moduleId)), origin(file, moduleId)),
  );
}
