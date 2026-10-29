export { generateBitaKit, detectFramework, loadDiscoveryConfig } from './generate.mjs';
export { watchBitaKit } from './watch.mjs';
/** Typed identity for `bitakit.config.ts`. */
export const defineBitaKit = (config) => config;
export { describeBitaKit, describeModule } from './describe.mjs';
export { migrateProject, rewriteRenamedNames } from './migrate.mjs';
export { contributionSegments } from './entries.mjs';
export { rewriteScopeAndSlots } from './scope-and-slots.mjs';
export {
  styleLayers,
  stylePrelude,
  cssImports,
  resolveStylesheet,
  validatePackageStyles,
} from './styles.mjs';
export { describeDefinitions } from './definition-info.mjs';

export { navigationPlacement } from './navigation-placement.mjs';
export { packagePluginId, pluginIdentityConflicts } from './package-identity.mjs';
