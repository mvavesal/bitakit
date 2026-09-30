import { createRequire } from 'node:module';
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const templates = fileURLToPath(new URL('../../templates/next/', import.meta.url));
import {
  configureProject,
  writeProjectFile,
  projectStyles,
  optionalPackages,
} from '../project-files.mjs';

/** Native Next scaffolding and essential Foundation configuration; no second discovery system. */
export const next = {
  label: 'Next.js (React)',
  async scaffold(plan, run) {
    await run(
      process.execPath,
      [
        require.resolve('create-next-app/dist/index.js'),
        plan.target,
        '--ts',
        '--tailwind',
        '--app',
        '--src-dir',
        '--empty',
        '--use-npm',
        '--skip-install',
        '--disable-git',
        '--no-eslint',
        '--no-biome',
        '--no-react-compiler',
        '--import-alias',
        '@/*',
        '--yes',
      ],
      path.dirname(plan.target),
    );
  },
  async configure(plan) {
    const shell = plan.features.includes('shell');
    const write = (file, content) => writeProjectFile(plan.target, file, content);
    await configureProject(plan, {
      packages: ['next', ...plan.features.map((feature) => optionalPackages[feature])],
      scripts: {
        typecheck: 'foundation-generate && next typegen && tsc --noEmit',
        dev: 'next dev --webpack',
        build: 'next build --webpack',
      },
    });
    await cp(path.join(templates, 'base'), plan.target, { recursive: true });
    await write('src/app/globals.css', projectStyles(plan.features));
    await write(
      'src/app/layout.tsx',
      `import type { ReactNode } from 'react';
import { FoundationProvider } from '@bitakit/next';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><FoundationProvider>{children}</FoundationProvider></body></html>;
}
`,
    );
    if (shell) {
      await cp(path.join(templates, 'shell'), plan.target, { recursive: true });
      await rm(path.join(plan.target, 'src/app/page.tsx'));
    }
  },
};
