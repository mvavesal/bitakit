/** Optional host presentation types. Core stores these values without rendering them. */
export interface PresentationTypes {}
export type PresentationType<Key extends string> = Key extends keyof PresentationTypes ? PresentationTypes[Key] : unknown;
