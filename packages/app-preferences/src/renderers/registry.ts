import type { ComponentType } from 'react';
import type { Setting } from '../fields/setting.js';
import type { Registration, SettingType } from '../types.js';

/** Replaceable parts of the default views. Only the application may replace them. */
export type SettingsViewPart = 'settings' | 'section' | 'field';
export type RendererLayer = 'app' | 'plugin' | 'builtin';
type Control = {
  component: ComponentType<any>;
  /** The control is a group (radio buttons, cards); it is labelled with aria-labelledby. */
  group?: boolean;
};
export type FieldRendererDescriptor = Control & { kind: 'field'; setting: Setting<any> };
export type TypeRendererDescriptor = Control & {
  kind: 'type';
  type: SettingType;
  variant?: string;
};
export type SectionRendererDescriptor = {
  kind: 'section';
  section: string;
  component: ComponentType<any>;
};
export type ViewRendererDescriptor = {
  kind: 'view';
  part: SettingsViewPart;
  component: ComponentType<any>;
};
export type RendererDescriptor =
  | FieldRendererDescriptor
  | TypeRendererDescriptor
  | SectionRendererDescriptor
  | ViewRendererDescriptor;
/** A declarative renderer file: every list is optional. */
export type SettingsRendererSet = Readonly<{
  fields?: readonly FieldRendererDescriptor[];
  types?: readonly TypeRendererDescriptor[];
  sections?: readonly SectionRendererDescriptor[];
  views?: readonly ViewRendererDescriptor[];
}>;
/** Who registers: derived from the module lifecycle by the Foundation integration. */
export type RendererOwner = Readonly<{ layer: RendererLayer; owner?: string; origin?: string }>;
type Entry = {
  descriptor: RendererDescriptor;
  layer: RendererLayer;
  owner?: string;
  origin: string;
};
export type ResolvedControl = Readonly<{
  component: ComponentType<any>;
  group: boolean;
  layer: RendererLayer;
  owner?: string;
  origin: string;
}>;

/** Raised for renderer configuration mistakes; views show it inline instead of silently falling back. */
export class SettingsConfigurationError extends Error {
  override name = 'SettingsConfigurationError';
}
const variantKey = (type: string, variant?: string) => `${type}:${variant ?? ''}`;
const targetOf = (descriptor: RendererDescriptor) => {
  switch (descriptor.kind) {
    case 'field':
      return `field "${descriptor.setting.key}"`;
    case 'type':
      return descriptor.variant
        ? `type "${descriptor.type}" variant "${descriptor.variant}"`
        : `type "${descriptor.type}"`;
    case 'section':
      return `section "${descriptor.section}"`;
    case 'view':
      return `view "${descriptor.part}"`;
  }
};
const indexKey = (descriptor: RendererDescriptor) => {
  switch (descriptor.kind) {
    case 'field':
      return `field:${descriptor.setting.key}`;
    case 'type':
      return `type:${variantKey(descriptor.type, descriptor.variant)}`;
    case 'section':
      return `section:${descriptor.section}`;
    case 'view':
      return `view:${descriptor.part}`;
  }
};
const where = (entry: { origin: string }) => entry.origin;
const isComponent = (value: unknown) =>
  typeof value === 'function' || (!!value && typeof value === 'object' && '$$typeof' in value);

/** Validates one descriptor; used by builders, normalizers and registration. */
export function assertRendererDescriptor(
  value: unknown,
  origin = 'a settings renderer',
): asserts value is RendererDescriptor {
  const descriptor = value as RendererDescriptor;
  if (!descriptor || typeof descriptor !== 'object' || !('kind' in descriptor))
    throw new SettingsConfigurationError(
      `Invalid settings renderer in ${origin}: use fieldRenderer(), typeRenderer(), sectionRenderer() or viewRenderer().`,
    );
  if (!isComponent(descriptor.component))
    throw new SettingsConfigurationError(
      `Settings renderer for ${targetOf(descriptor)} in ${origin} needs a React component.`,
    );
  if (
    descriptor.kind === 'field' &&
    (!descriptor.setting || typeof descriptor.setting.key !== 'string')
  )
    throw new SettingsConfigurationError(
      `Field renderer in ${origin} must reference a setting definition.`,
    );
  if (
    descriptor.kind === 'type' &&
    !['boolean', 'choice', 'multi-choice', 'text', 'number'].includes(descriptor.type)
  )
    throw new SettingsConfigurationError(
      `Unknown setting type "${String(descriptor.type)}" in ${origin}.`,
    );
  if (
    descriptor.kind === 'type' &&
    descriptor.variant !== undefined &&
    !/^[a-z][a-z0-9-]*$/.test(descriptor.variant)
  )
    throw new SettingsConfigurationError(`Invalid variant "${descriptor.variant}" in ${origin}.`);
  if (descriptor.kind === 'section' && !/^[a-z][a-z0-9-]*$/.test(descriptor.section))
    throw new SettingsConfigurationError(
      `Invalid section ID "${descriptor.section}" in ${origin}.`,
    );
  if (descriptor.kind === 'view' && !['settings', 'section', 'field'].includes(descriptor.part))
    throw new SettingsConfigurationError(
      `Unknown settings view part "${String(descriptor.part)}" in ${origin}.`,
    );
}
export function rendererDescriptors(set: SettingsRendererSet): RendererDescriptor[] {
  return [
    ...(set.fields ?? []),
    ...(set.types ?? []),
    ...(set.sections ?? []),
    ...(set.views ?? []),
  ];
}

/**
 * An immutable resolution view. Resolution is deterministic:
 * app field > owner plugin field > app type+variant > owner plugin type+variant > built-in variant
 * > app type > owner plugin type > built-in type. A requested variant never falls back to a generic
 * renderer; an unknown variant is a configuration error.
 */
export class RendererSnapshot {
  private index = new Map<string, Entry[]>();
  constructor(
    entries: readonly Entry[],
    readonly version: number,
  ) {
    for (const entry of entries) {
      const key = indexKey(entry.descriptor);
      this.index.set(key, [...(this.index.get(key) ?? []), entry]);
    }
  }
  private pick(key: string, layer: RendererLayer, owners?: readonly string[]) {
    const matches = (this.index.get(key) ?? []).filter(
      (entry) => entry.layer === layer && (!owners || owners.includes(entry.owner ?? '')),
    );
    if (matches.length > 1)
      throw new SettingsConfigurationError(
        `Conflicting settings renderers for ${targetOf(matches[0]!.descriptor)}: ${matches.map(where).join(' and ')}.`,
      );
    return matches[0];
  }
  private control(entry: Entry): ResolvedControl {
    const descriptor = entry.descriptor as FieldRendererDescriptor | TypeRendererDescriptor;
    return Object.freeze({
      component: descriptor.component,
      group: descriptor.group ?? false,
      layer: entry.layer,
      owner: entry.owner,
      origin: entry.origin,
    });
  }
  /** `owners` are the modules owning the field; plugin renderers apply only to their own fields. */
  resolveField(setting: Setting<any>, owners: readonly string[] = []): ResolvedControl {
    const fieldKey = `field:${setting.key}`;
    const foreign = (this.index.get(fieldKey) ?? []).find(
      (entry) => entry.layer === 'plugin' && !owners.includes(entry.owner ?? ''),
    );
    if (foreign)
      throw new SettingsConfigurationError(
        `Settings renderer from ${where(foreign)} targets field "${setting.key}", which "${foreign.owner}" does not own. Only the application may override another module's field.`,
      );
    const field = this.pick(fieldKey, 'app') ?? this.pick(fieldKey, 'plugin', owners);
    if (field) return this.control(field);
    const variant = setting.presentation.variant;
    if (variant) {
      const key = `type:${variantKey(setting.type, variant)}`;
      const match =
        this.pick(key, 'app') ?? this.pick(key, 'plugin', owners) ?? this.pick(key, 'builtin');
      if (match) return this.control(match);
      throw new SettingsConfigurationError(
        `Unknown variant "${variant}" for ${setting.type} setting "${setting.key}". Register typeRenderer('${setting.type}', Component, { variant: '${variant}' }) or remove the variant.`,
      );
    }
    const key = `type:${variantKey(setting.type)}`;
    const match =
      this.pick(key, 'app') ?? this.pick(key, 'plugin', owners) ?? this.pick(key, 'builtin');
    if (match) return this.control(match);
    throw new SettingsConfigurationError(
      `No renderer for ${setting.type} setting "${setting.key}".`,
    );
  }
  /** App section renderers apply to any section; plugin ones only to sections they own. */
  resolveSection(section: { id: string; pluginId?: string }): ComponentType<any> | undefined {
    const key = `section:${section.id}`;
    const foreign = (this.index.get(key) ?? []).find(
      (entry) => entry.layer === 'plugin' && entry.owner !== section.pluginId,
    );
    if (foreign)
      throw new SettingsConfigurationError(
        `Settings renderer from ${where(foreign)} targets section "${section.id}", which "${foreign.owner}" does not own.`,
      );
    return (
      this.pick(key, 'app') ??
      this.pick(key, 'plugin', section.pluginId ? [section.pluginId] : []) ??
      this.pick(key, 'builtin')
    )?.descriptor.component;
  }
  resolveView(part: SettingsViewPart): ComponentType<any> | undefined {
    const key = `view:${part}`;
    return (this.pick(key, 'app') ?? this.pick(key, 'builtin'))?.descriptor.component;
  }
}

/** Application-scoped registry. Create one per application instance; never share it globally. */
export class SettingsRendererRegistry {
  private entries: Entry[] = [];
  private listeners = new Set<() => void>();
  private snapshot: RendererSnapshot;
  private version = 0;
  constructor(defaults: SettingsRendererSet = {}) {
    for (const descriptor of rendererDescriptors(defaults))
      this.insert(descriptor, { layer: 'builtin', origin: 'built-in renderers' });
    this.snapshot = new RendererSnapshot(this.entries, this.version);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** Registers descriptors for one owner. Duplicate targets on the same layer and owner are rejected. */
  register(
    descriptors: RendererDescriptor | readonly RendererDescriptor[],
    owner: RendererOwner,
  ): Registration {
    const list: readonly RendererDescriptor[] = Array.isArray(descriptors)
      ? descriptors
      : [descriptors as RendererDescriptor];
    const added: Entry[] = [];
    try {
      for (const descriptor of list) added.push(this.insert(descriptor, owner));
    } catch (error) {
      this.entries = this.entries.filter((entry) => !added.includes(entry));
      throw error;
    }
    this.publish();
    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        this.entries = this.entries.filter((entry) => !added.includes(entry));
        this.publish();
      },
    };
  }
  registerSet(set: SettingsRendererSet, owner: RendererOwner) {
    return this.register(rendererDescriptors(set), owner);
  }
  private insert(descriptor: RendererDescriptor, owner: RendererOwner) {
    const origin = owner.origin ?? (owner.owner ? `"${owner.owner}"` : 'the application');
    assertRendererDescriptor(descriptor, origin);
    if (owner.layer === 'plugin' && !owner.owner)
      throw new SettingsConfigurationError(
        `Plugin settings renderers need an owning module (${origin}).`,
      );
    if (descriptor.kind === 'view' && owner.layer === 'plugin')
      throw new SettingsConfigurationError(
        `Only the application may replace the settings ${descriptor.part} view (${origin}).`,
      );
    const key = indexKey(descriptor);
    const duplicate = this.entries.find(
      (entry) =>
        indexKey(entry.descriptor) === key &&
        entry.layer === owner.layer &&
        (owner.layer !== 'plugin' || entry.owner === owner.owner),
    );
    if (duplicate)
      throw new SettingsConfigurationError(
        `Duplicate settings renderer for ${targetOf(descriptor)}: ${duplicate.origin} and ${origin}.`,
      );
    const entry: Entry = { descriptor, layer: owner.layer, owner: owner.owner, origin };
    this.entries.push(entry);
    return entry;
  }
  private publish() {
    this.snapshot = new RendererSnapshot(this.entries, ++this.version);
    for (const listener of this.listeners) listener();
  }
}
