import { createRequire } from 'node:module';
import { cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  configureProject,
  writeProjectFile,
  projectStyles,
  optionalPackages,
} from '../project-files.mjs';
const require = createRequire(import.meta.url);
const templates = fileURLToPath(new URL('../../templates/tanstack/', import.meta.url));

/** Official blank Start scaffold with native routes and the optional Foundation host adapter. */
export const tanstack = {
  label: 'TanStack Start (React, experimental)',
  async scaffold(plan, run) {
    await run(
      process.execPath,
      [
        path.join(path.dirname(require.resolve('@tanstack/cli')), 'bin.js'),
        'create',
        plan.name,
        '--target-dir',
        plan.target,
        '--framework',
        'React',
        '--blank',
        '--no-install',
        '--no-git',
        '--no-intent',
        '--no-toolchain',
        '--yes',
      ],
      path.dirname(plan.target),
    );
  },
  async configure(plan) {
    await configureProject(plan, {
      packages: ['tanstack', ...plan.features.map((feature) => optionalPackages[feature])],
      dependencies: { '@tanstack/react-router': '1.170.40', '@tanstack/react-start': '1.168.59' },
      devDependencies: { '@tailwindcss/vite': '^4.1.0', tailwindcss: '^4.1.0' },
      scripts: { typecheck: 'foundation-generate && tsr generate && tsc --noEmit' },
    });
    await cp(path.join(templates, 'base'), plan.target, { recursive: true });
    if (plan.features.includes('shell'))
      await cp(path.join(templates, 'shell'), plan.target, { recursive: true });
    await writeProjectFile(plan.target, 'src/styles.css', projectStyles(plan.features));
  },
};
