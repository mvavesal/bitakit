import { createRequire } from 'node:module';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  agentRules,
  configureProject,
  optionalPackages,
  projectStyles,
  readme,
  shellConfig,
  writeProjectFiles,
} from '../project-files.mjs';

const require = createRequire(import.meta.url);

const layout = `import type { ReactNode } from 'react';
import { FoundationProvider } from '@bitakit/next';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FoundationProvider>{children}</FoundationProvider>
      </body>
    </html>
  );
}
`;

const home = (subtitle) => `'use client';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return <PageHeader title="Welcome" subtitle="${subtitle}" />;
}
`;

/** Native Next scaffolding plus the few files BitaKit needs; no second discovery system. */
export const next = {
  label: 'Next.js',
  routes: 'src/app',
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
    await configureProject(plan, {
      packages: ['next', ...plan.features.map((feature) => optionalPackages[feature])],
      scripts: {
        typecheck: 'foundation-generate && next typegen && tsc --noEmit',
        // The Next adapter uses Webpack while a Turbopack alias issue is open.
        dev: 'next dev --webpack',
        build: 'next build --webpack',
      },
    });
    // create-next-app's empty page moves into the route group that renders the app frame.
    await rm(path.join(plan.target, 'src/app/page.tsx'), { force: true });
    const subtitle = plan.sample
      ? 'Open Todos in the navigation, or add a feature with npx bitakit add plugin notes.'
      : 'Edit this page, or add a feature with npx bitakit add plugin notes.';
    const files = {
      'next.config.ts': `import { withFoundation } from '@bitakit/next/config';

export default withFoundation({});
`,
      'src/app/layout.tsx': layout,
      'src/app/globals.css': projectStyles('../..'),
    };
    if (shell)
      Object.assign(files, {
        'src/configs/shell.ts': shellConfig,
        'src/app/(app)/layout.tsx': `import type { ReactNode } from 'react';
import { AppShell } from '@bitakit/shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
`,
        'src/app/(app)/page.tsx': home(subtitle),
        // Renders plugin pages such as /todos; unknown paths show the not-found state.
        'src/app/(app)/[...path]/page.tsx': `'use client';
import { PluginPage } from '@bitakit/ui';
import { NotFoundPage } from '@bitakit/shell/pages';

export default function Page() {
  return <PluginPage fallback={<NotFoundPage />} />;
}
`,
        'src/app/settings/[[...section]]/page.tsx': `'use client';
import { SettingsRoute } from '@bitakit/shell';

export default function Page() {
  return <SettingsRoute />;
}
`,
      });
    else
      Object.assign(files, {
        'src/app/page.tsx': home(subtitle),
        // Renders plugin pages such as /todos.
        'src/app/[...path]/page.tsx': `'use client';
import { PluginPage } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Page() {
  return <PluginPage fallback={<PageHeader title="Page not found" />} />;
}
`,
      });
    await writeProjectFiles(plan.target, files);
    const rules = await readFile(path.join(plan.target, 'AGENTS.md'), 'utf8').catch(() => '');
    await writeProjectFiles(plan.target, {
      'AGENTS.md': `${rules ? `${rules.trimEnd()}\n\n` : ''}${agentRules(plan, next)}`,
      'README.md': readme(plan, next),
    });
  },
};
