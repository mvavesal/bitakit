export {
  generateFoundation,
  generateFoundation as generateBitaKit,
  detectFramework,
  loadDiscoveryConfig,
} from './generate.mjs';
export { watchFoundation, watchFoundation as watchBitaKit } from './watch.mjs';
/** Typed identity for `bitakit.config.ts`. */
export const defineBitaKit = (config) => config;
/** @deprecated Use defineBitaKit in bitakit.config.ts. */
export const defineFoundation = defineBitaKit;
export { generateFoundationHost } from './host.mjs';
export { describeFoundation, describeModule } from './describe.mjs';
export { migrateProject } from './migrate.mjs';
export { styleLayers, stylePrelude, cssImports, resolveStylesheet, validatePackageStyles } from './styles.mjs';
