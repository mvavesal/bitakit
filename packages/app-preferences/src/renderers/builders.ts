import type { ComponentType } from 'react';
import type { Setting } from '../fields/setting.js';
import type { SettingType } from '../types.js';
import {
  assertRendererDescriptor,
  type FieldRendererDescriptor,
  type SectionRendererDescriptor,
  type SettingsRendererSet,
  type SettingsViewPart,
  type TypeRendererDescriptor,
  type ViewRendererDescriptor,
} from './registry.js';
import type {
  SettingControlProps,
  SettingsSectionRendererProps,
  SettingsViewPropsMap,
  TypeControlProps,
} from './types.js';

type ControlOptions = { group?: boolean };
/** Replaces the control of one field. Props are typed from the field reference. */
export function fieldRenderer<S extends Setting<any>>(
  setting: S,
  component: ComponentType<SettingControlProps<S>>,
  options: ControlOptions = {},
): FieldRendererDescriptor {
  const descriptor: FieldRendererDescriptor = { kind: 'field', setting, component, ...options };
  assertRendererDescriptor(descriptor);
  return descriptor;
}
/** Renders every field of a value type, or only fields requesting `variant`. */
export function typeRenderer<K extends SettingType>(
  type: K,
  component: ComponentType<TypeControlProps<K>>,
  options: ControlOptions & { variant?: string } = {},
): TypeRendererDescriptor {
  const descriptor: TypeRendererDescriptor = { kind: 'type', type, component, ...options };
  assertRendererDescriptor(descriptor);
  return descriptor;
}
/** Replaces the layout of one section; items arrive pre-bound. */
export function sectionRenderer(
  section: string,
  component: ComponentType<SettingsSectionRendererProps>,
): SectionRendererDescriptor {
  const descriptor: SectionRendererDescriptor = { kind: 'section', section, component };
  assertRendererDescriptor(descriptor);
  return descriptor;
}
/** Replaces a default view part. Only the application layer may register views. */
export function viewRenderer<P extends SettingsViewPart>(
  part: P,
  component: ComponentType<SettingsViewPropsMap[P]>,
): ViewRendererDescriptor {
  const descriptor: ViewRendererDescriptor = { kind: 'view', part, component };
  assertRendererDescriptor(descriptor);
  return descriptor;
}
/** A declarative renderer file. Ownership and layer come from the contributing module. */
export function defineSettingsRenderers(set: SettingsRendererSet): SettingsRendererSet {
  return Object.freeze({ ...set });
}
