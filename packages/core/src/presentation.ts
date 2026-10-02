/** Optional host presentation types. Core stores these values without rendering them. */
export interface PresentationTypes {}
export type PresentationType<Key extends string> = Key extends keyof PresentationTypes
  ? PresentationTypes[Key]
  : unknown;

/** Slot names a layout renders. Generated from installed shells and `bitakit.config.ts`; augmentable by hand. */
export interface SlotMap {}
export type SlotName = Extract<keyof SlotMap, string> | (string & {});
