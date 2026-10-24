/** The package managers an app can be created and installed with. */
export const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'];

/**
 * The package manager that started the generator. npm, pnpm, Yarn and Bun set
 * `npm_config_user_agent` for `create`, `dlx` and `x`; anything else falls back to npm.
 */
export function detectPackageManager(env = process.env) {
  const name = env.npm_config_user_agent?.split('/')[0];
  return packageManagers.includes(name) ? name : 'npm';
}

/** A package script in the form every supported package manager accepts. */
export const runScript = (packageManager, script) => `${packageManager} run ${script}`;
