import type { GeneratedName } from './names.js';

/** Optional host presentation types. Core stores these values without rendering them. */
export interface PresentationTypes {}
export type PresentationType<Key extends string> = Key extends keyof PresentationTypes
  ? PresentationTypes[Key]
  : unknown;

/** Owned slot definitions, generated from `slots/`; augmentable for manual composition. */
export interface SlotMap {}
/** Transitional name hints only. They neither declare a contract nor activate a slot. */
export interface LegacySlotMap {}
/** A declared slot or legacy outlet name; strict generated apps reject unknown names. */
export type SlotName = GeneratedName<Extract<keyof SlotMap | keyof LegacySlotMap, string>>;
