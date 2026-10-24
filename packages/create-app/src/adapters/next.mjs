import { createRequire } from 'node:module';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  claudeFileFor,
  nextConfigFile,
  wrapNextConfig,
  writeAppDevelopmentSkills,
} from '@bitakit/cli';
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

/** With the Shell, the theme script pre-paints the stored color scheme before React hydrates. */
const layout = (shell) => `import type { ReactNode } from 'react';
${shell ? "import { ShellThemeScript } from '@bitakit/shell';\n" : ''}import { BitaKitProvider } from '@/bitakit.gen';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"${shell ? ' suppressHydrationWarning' : ''}>
${shell ? '      <head>\n        <ShellThemeScript />\n      </head>\n' : ''}      <body>
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
        `--use-${plan.packageManager ?? 'npm'}`,
        '--skip-install',
        '--disable-git',
        '--no-eslint',
        '--no-biome',
        '--no-react-compiler',
        // The user's saved create-next-app preferences must not decide this with --yes.
        '--no-cache-components',
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
    // Without Shell there is no navigation, so the sample is reached by its URL.
    const subtitle = plan.sample
      ? shell
        ? 'Open Todos in the navigation, or add a feature with npx bitakit add plugin notes.'
        : 'Open /todos, or add a feature with npx bitakit add plugin notes.'
      : 'Edit this page, or add a feature with npx bitakit add plugin notes.';
    // Wrap the scaffolded configuration: it carries the framework's own setup, such as the
    // @tailwindcss/turbopack loader rule, which BitaKit's package styles need.
    const scaffolded = await readFile(path.join(plan.target, 'next.config.ts'), 'utf8').catch(
      () => undefined,
    );
    const files = {
      'next.config.ts':
        (scaffolded && wrapNextConfig(scaffolded, 'next.config.ts')) ?? nextConfigFile,
      'src/app/layout.tsx': layout(shell),
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
        // Next.js error files render Shell's replaceable screens (screen.error, screen.not-found).
        'src/app/(app)/error.tsx': `'use client';
import { ErrorPage } from '@bitakit/shell/pages';

// Errors in app pages, inside the app frame. A screen.error contribution replaces this page.
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorPage reset={retry} />;
}
`,
        'src/app/not-found.tsx': `import { AppShell } from '@bitakit/shell';
import { NotFoundPage } from '@bitakit/shell/pages';

// notFound() outside app pages. The error layout and screen.not-found can be replaced.
export default function NotFound() {
  return (
    <AppShell layout="error">
      <NotFoundPage />
    </AppShell>
  );
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
    const claude = await readFile(path.join(plan.target, 'CLAUDE.md'), 'utf8').catch(
      () => undefined,
    );
    await writeProjectFiles(plan.target, {
      'AGENTS.md': `${rules ? `${rules.trimEnd()}\n\n` : ''}${agentRules(plan, next)}`,
      // create-next-app writes AGENTS.md only; Claude Code needs CLAUDE.md to load it.
      'CLAUDE.md': claudeFileFor(claude),
      'README.md': readme(plan, next),
    });
    await writeAppDevelopmentSkills(plan.target);
  },
};
