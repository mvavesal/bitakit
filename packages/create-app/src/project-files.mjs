import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Write a generated project file; only called after the empty destination was created. */
export async function writeProjectFile(root, file, content) {
  const destination = path.join(root, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

/** Shared package composition; framework adapters supply their own dependencies and scripts. */
export async function configureProject(
  plan,
  { packages, dependencies = {}, devDependencies = {}, scripts = {} },
) {
  const manifest = JSON.parse(await readFile(path.join(plan.target, 'package.json'), 'utf8'));
  for (const name of ['core', 'ui', ...packages])
    manifest.dependencies[`@bitakit/${name}`] = '0.1.0';
  Object.assign(manifest.dependencies, { 'tw-animate-css': '^1.4.0' }, dependencies);
  Object.assign((manifest.devDependencies ??= {}), devDependencies);
  Object.assign(manifest.scripts, scripts);
  await writeProjectFile(plan.target, 'package.json', JSON.stringify(manifest, null, 2) + '\n');
  const ignored = await readFile(path.join(plan.target, '.gitignore'), 'utf8').catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return 'node_modules/\ndist/\n.env*\n';
  });
  await writeProjectFile(
    plan.target,
    '.gitignore',
    `${ignored}\n# Generated Foundation discovery\n.foundation/\nfoundation-env.d.ts\n`,
  );
  await writeProjectFile(
    plan.target,
    'README.md',
    `# ${plan.name}\n\nMinimal ${plan.framework} frontend with BitaKit.\n${plan.framework === 'tanstack' ? '\nExperimental TanStack Start integration: upstream nuqs does not guarantee Start support.\n' : ''}\nRun npm install, npm run dev, npm run typecheck, or npm run build.\n\nSelected features: ${plan.features.join(', ') || 'none'}.\n\nAdd product code through native framework routes and Foundation contribution conventions.\nPlugin implementations stay in their packages; no backend, authentication server, database\nor demo data is generated. Shared theme tokens are exported by @bitakit/ui/theme.css.\n\nRegistry packages must be available, or use local tarballs before publication.\n${plan.features.includes('shell') ? '\nShell settings are available at /settings/appearance. Preferences are device-local.\n' : ''}`,
  );
}

export const baseStyles =
  [
    "@import 'tailwindcss';",
    "@import 'tw-animate-css';",
    "@import '@bitakit/ui/styles.css';",
    "@import '@bitakit/ui/theme.css';",
  ].join('\n') + '\n';

export const optionalPackages = {
  preferences: 'app-preferences',
  shell: 'shell',
  'quick-search': 'quick-search',
};

/** Each selected visual package owns its CSS sources; never scan the whole workspace. */
export function projectStyles(features) {
  return (
    baseStyles +
    features
      .filter((feature) => feature !== 'quick-search')
      .map((feature) => `@import '@bitakit/${optionalPackages[feature]}/styles.css';`)
      .join('\n') +
    '\n'
  );
}
