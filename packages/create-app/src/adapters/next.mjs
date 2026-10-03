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
import { BitaKitProvider } from '@/bitakit.gen';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BitaKitProvider>{children}</BitaKitProvider>
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
    const preferences = plan.features.includes('preferences');
    await configureProject(plan, {
      packages: ['next', ...plan.features.map((feature) => optionalPackages[feature])],
      scripts: {
        typecheck: 'bitakit generate && next typegen && tsc --noEmit',
        dev: 'next dev',
        build: 'next build',
      },
    });
    await rm(path.join(plan.target, 'src/app/page.tsx'), { force: true });
    const subtitle = plan.sample
      ? 'Open Todos in the navigation, or add a feature with npx bitakit add plugin notes.'
      : 'Edit this page, or add a feature with npx bitakit add plugin notes.';
    const files = {
      'next.config.ts': `import { withBitaKit } from '@bitakit/next/config';

export default withBitaKit({});
`,
      'src/app/layout.tsx': layout,
      'src/app/globals.css': projectStyles('..'),
    };
    // Settings pages come with App Preferences, with or without the Shell frame.
    if (preferences)
      files['src/app/settings/[[...section]]/page.tsx'] = `'use client';
import { SettingsRoute } from '@bitakit/app-preferences';

export default function Page() {
  return <SettingsRoute />;
}
`;
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
