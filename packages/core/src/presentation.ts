/** Optional host presentation types. Core stores these values without rendering them. */
export interface PresentationTypes {}
export type PresentationType<Key extends string> = Key extends keyof PresentationTypes
  ? PresentationTypes[Key]
  : unknown;

/** Owned slot definitions, generated from `slots/`; augmentable for manual composition. */
export interface SlotMap {}
/** Transitional name hints only. They neither declare a contract nor activate a slot. */
export interface LegacySlotMap {}
export type SlotName = Extract<keyof SlotMap | keyof LegacySlotMap, string> | (string & {});
