#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, Option } from 'commander';
import * as prompts from '@clack/prompts';
import { createProject, planProject, adapters } from './create-app.mjs';
import { features, defaultFeatures } from './features.mjs';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const program = new Command()
  .name('create-bitakit-app')
  .description('Create a BitaKit app (Next.js or TanStack Start) or a standalone plugin package.')
  .version(manifest.version)
  .argument('[directory]', 'new project directory')
  .option('--plugin', 'create a standalone plugin package with a playground app')
  .addOption(new Option('--framework <name>', 'framework').choices(Object.keys(adapters)))
  .option(
    '--features <names>',
    `comma-separated ${Object.keys(features).join(', ')}, or none (default: ${defaultFeatures.join(',')})`,
  )
  .option('--sample', 'add the Todos sample plugin')
  .option('--no-sample', 'do not add the Todos sample plugin')
  .option('-y, --yes', 'use defaults without prompts')
  .option('--no-install', 'generate files without installing dependencies')
  .option('--packages-dir <directory>', 'install BitaKit from local npm-packed tarballs')
  .option('--dry-run', 'show the resolved plan without writing or installing')
  .addHelpText(
    'after',
    `
Examples:
  npm create @bitakit/app my-app
  npm create @bitakit/app my-app -- --framework tanstack --sample --yes
  npm create @bitakit/app my-plugin -- --plugin`,
  )
  .action(async (directory, options) => {
    const interactive = !options.yes && process.stdin.isTTY && process.stdout.isTTY;
    const answer = async (prompt) => {
      const value = await prompt;
      if (prompts.isCancel(value)) {
        prompts.cancel('Cancelled. Nothing was created.');
        process.exit(0);
      }
      return value;
    };
    if (interactive) prompts.intro(`BitaKit ${manifest.version}`);
    const type = options.plugin
      ? 'plugin'
      : interactive && !directory
        ? await answer(
            prompts.select({
              message: 'What do you want to create?',
              options: [
                { value: 'app', label: 'An app', hint: 'Next.js or TanStack Start' },
                {
                  value: 'plugin',
                  label: 'A standalone plugin',
                  hint: 'an npm package with a playground',
                },
              ],
            }),
          )
        : 'app';
    if (!directory) {
      if (!interactive) throw new Error('Provide a project directory. Use --help for examples.');
      const fallback = type === 'plugin' ? 'my-plugin' : 'my-app';
      directory = await answer(
        prompts.text({
          message: 'Project directory',
          placeholder: fallback,
          defaultValue: fallback,
        }),
      );
    }
    options.framework ??= interactive
      ? await answer(
          prompts.select({
            message: type === 'plugin' ? 'Playground framework' : 'Framework',
            options: Object.entries(adapters).map(([value, adapter]) => ({
              value,
              label: adapter.label,
            })),
          }),
        )
      : 'next';
    let selected =
      options.features === 'none'
        ? []
        : options.features
            ?.split(',')
            .map((name) => name.trim())
            .filter(Boolean);
    if (type === 'app' && !selected)
      selected = interactive
        ? await answer(
            prompts.multiselect({
              message: 'Features',
              required: false,
              initialValues: defaultFeatures,
              options: Object.entries(features).map(([value, feature]) => ({
                value,
                label: feature.label,
              })),
            }),
          )
        : defaultFeatures;
    let sample = options.sample;
    if (type === 'app' && sample === undefined)
      sample = interactive
        ? await answer(
            prompts.confirm({
              message: 'Add the Todos sample plugin to learn from?',
              initialValue: true,
            }),
          )
        : false;
    const plan = await planProject(directory, { ...options, type, features: selected, sample });
    const summary = [
      `Project:   ${plan.target}`,
      `Type:      ${plan.type === 'plugin' ? `plugin package with a ${adapters[plan.framework].label} playground` : `${adapters[plan.framework].label} app`}`,
      ...(plan.type === 'app'
        ? [
            `Features:  ${plan.features.join(', ') || 'none'}`,
            `Sample:    ${plan.sample ? 'Todos plugin' : 'no'}`,
          ]
        : []),
      `Install:   ${plan.install ? 'yes' : 'no'}`,
    ].join('\n');
    if (interactive) prompts.note(summary, 'Creating');
    else console.log(`\n${summary}\n`);
    if (options.dryRun) return;
    try {
      await createProject(plan, { packagesDir: options.packagesDir });
    } catch (error) {
      throw new Error(
        `${error.message}\nNo existing project was overwritten. Any generated files remain at ${plan.target} for inspection.`,
        { cause: error },
      );
    }
    const where = path.relative(process.cwd(), plan.target) || '.';
    const steps = [
      `cd ${where}`,
      ...(plan.install ? [] : ['npm install']),
      'npm run dev',
      '',
      ...(plan.type === 'plugin'
        ? [
            'Edit src/ — the playground reloads.',
            'npm test        run the plugin tests',
            'npm run build   build the package for npm',
          ]
        : [
            'npx bitakit add plugin notes   add a feature',
            'npx bitakit doctor             check the project',
          ]),
    ].join('\n');
    if (interactive) prompts.outro(`Done! Next steps:\n\n${steps}`);
    else console.log(`\nDone! Next steps:\n\n${steps}\n`);
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
