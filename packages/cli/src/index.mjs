/** Programmatic API shared by the `bitakit` CLI and the project generator. */
export { addPlugin, addContribution, writeNewFiles, contributionKinds } from './add.mjs';
export { agentRules, agentRulesBegin, agentRulesEnd, bitakitIdentity } from './agent-rules.mjs';
export { buildPlugin } from './build.mjs';
export { doctor } from './doctor.mjs';
export {
  bitakitConfigFile,
  gitignoreBlock,
  initProject,
  nextConfigFile,
  nextConfigImport,
  viteConfigImport,
  wrapNextConfig,
} from './init.mjs';
export { findProject, findProjectRoot, packagePluginId } from './project.mjs';
export { appRoutes, catchAllRoute } from './routes.mjs';
export {
  actionFile,
  configFile,
  eventsFile,
  interceptorFile,
  pageFile,
  pluginFiles,
  sampleFiles,
  starterFiles,
  serviceFile,
  titleOf,
  pascalOf,
  validateName,
} from './templates.mjs';
