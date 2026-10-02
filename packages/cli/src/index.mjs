/** Programmatic API shared by the `bitakit` CLI and the project generator. */
export { addPlugin, addContribution, writeNewFiles } from './add.mjs';
export { buildPlugin } from './build.mjs';
export { doctor } from './doctor.mjs';
export { findProject, packagePluginId } from './project.mjs';
export { appRoutes, catchAllRoute } from './routes.mjs';
export {
  actionFile,
  pageFile,
  pluginFiles,
  serviceFile,
  titleOf,
  pascalOf,
  validateName,
} from './templates.mjs';
