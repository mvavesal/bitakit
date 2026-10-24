import { createRequire } from 'node:module';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { claudeFileFor, viteConfigImport, writeAppDevelopmentSkills } from '@bitakit/cli';
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
const root = (
  title,
  shell,
) => `import { HeadContent, Scripts, Outlet, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
${shell ? "import { ShellThemeScript } from '@bitakit/shell';\n" : ''}import { BitaKitProvider } from '../bitakit.gen';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: ${JSON.stringify(title)} },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: () => (
    <BitaKitProvider>
      <Outlet />
    </BitaKitProvider>
  ),
  shellComponent: Document,
});

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en"${shell ? ' suppressHydrationWarning' : ''}>
      <head>
        <HeadContent />
${shell ? '        <ShellThemeScript />\n' : ''}      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
`;

const home = (route, subtitle) => `import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@bitakit/ui/components';

export const Route = createFileRoute('${route}')({
  component: () => <PageHeader title="Welcome" subtitle="${subtitle}" />,
});
`;

/** Official blank Start scaffold plus the few files BitaKit needs. */
export const tanstack = {
  label: 'TanStack Start (experimental)',
  routes: 'src/routes',
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
    const shell = plan.features.includes('shell');
    const preferences = plan.features.includes('preferences');
    await configureProject(plan, {
      packages: ['tanstack', ...plan.features.map((feature) => optionalPackages[feature])],
      dependencies: { '@tanstack/react-router': '1.170.40', '@tanstack/react-start': '1.168.59' },
      devDependencies: { '@tailwindcss/vite': '^4.1.0', tailwindcss: '^4.1.0' },
      scripts: { typecheck: 'bitakit generate && tsr generate && tsc --noEmit' },
    });
    await rm(path.join(plan.target, 'src/routes/index.tsx'), { force: true });
    // Without Shell there is no navigation, so the sample is reached by its URL.
    const subtitle = plan.sample
      ? shell
        ? 'Open Todos in the navigation, or add a feature with npx bitakit add plugin notes.'
        : 'Open /todos, or add a feature with npx bitakit add plugin notes.'
      : 'Edit this page, or add a feature with npx bitakit add plugin notes.';
    const files = {
      'vite.config.ts': `import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
${viteConfigImport}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [bitakit(), tanstackStart(), react(), tailwindcss()],
});
`,
      'src/styles.css': projectStyles('.'),
      'src/routes/__root.tsx': root(plan.name, shell),
    };
    // Settings pages come with App Preferences, with or without the Shell frame.
    if (preferences)
      files['src/routes/settings.$.tsx'] =
        `import { createFileRoute } from '@tanstack/react-router';
import { SettingsRoute } from '@bitakit/app-preferences';

export const Route = createFileRoute('/settings/$')({ component: SettingsRoute });
`;
    if (shell)
      Object.assign(files, {
        'src/configs/shell.ts': shellConfig,
        'src/routes/_app.tsx': `import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '@bitakit/shell';
import { ErrorPage, NotFoundPage } from '@bitakit/shell/pages';

// Errors and notFound() in app pages render Shell's replaceable screen.error and screen.not-found.
export const Route = createFileRoute('/_app')({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  errorComponent: ({ reset }) => (
    <AppShell>
      <ErrorPage reset={reset} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell layout="error">
      <NotFoundPage />
    </AppShell>
  ),
});
`,
        'src/routes/_app.index.tsx': home('/_app/', subtitle),
        'src/routes/_app.$.tsx': `import { createFileRoute } from '@tanstack/react-router';
import { PluginPage } from '@bitakit/ui';
import { NotFoundPage } from '@bitakit/shell/pages';

export const Route = createFileRoute('/_app/$')({
  component: () => <PluginPage fallback={<NotFoundPage />} />,
});
`,
      });
    else
      Object.assign(files, {
        'src/routes/index.tsx': home('/', subtitle),
        'src/routes/$.tsx': `import { createFileRoute } from '@tanstack/react-router';
import { PluginPage } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export const Route = createFileRoute('/$')({
  component: () => <PluginPage fallback={<PageHeader title="Page not found" />} />,
});
`,
      });
    await writeProjectFiles(plan.target, files);
    const rules = await readFile(path.join(plan.target, 'AGENTS.md'), 'utf8').catch(() => '');
    const claude = await readFile(path.join(plan.target, 'CLAUDE.md'), 'utf8').catch(
      () => undefined,
    );
    await writeProjectFiles(plan.target, {
      'AGENTS.md': `${rules ? `${rules.trimEnd()}\n\n` : ''}${agentRules(plan, tanstack)}`,
      'CLAUDE.md': claudeFileFor(claude),
      'README.md': readme(plan, tanstack),
    });
    await writeAppDevelopmentSkills(plan.target);
  },
};
