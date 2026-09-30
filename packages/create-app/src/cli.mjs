#!/usr/bin/env node
import { Command, Option } from 'commander';
import * as prompts from '@clack/prompts';
import { createApp, planProject, adapters } from './create-app.mjs';
import { features } from './features.mjs';

const program = new Command()
  .name('create-bitakit-app')
  .description(
    'Create a minimal Foundation frontend. Choose Next.js or experimental TanStack Start.',
  )
  .version('0.1.0')
  .argument('[directory]', 'new project directory')
  .addOption(new Option('--framework <name>', 'frontend framework').choices(Object.keys(adapters)))
  .option('--features <names>', 'comma-separated preferences,shell,quick-search (or none)')
  .option('-y, --yes', 'use defaults without prompts')
  .option('--no-install', 'generate files without installing dependencies')
  .option(
    '--packages-dir <directory>',
    'use local npm-packed Foundation tarballs before publication',
  )
  .option('--dry-run', 'show the resolved plan without writing or installing')
  .action(async (directory, options) => {
    const interactive = !options.yes && process.stdin.isTTY && process.stdout.isTTY;
    const answer = async (prompt) => {
      const value = await prompt;
      if (prompts.isCancel(value)) {
        prompts.cancel('Cancelled. No project was created.');
        process.exit(0);
      }
      return value;
    };
    if (!directory) {
      if (!interactive) throw new Error('Provide a project directory. Use --help for examples.');
      directory = await answer(
        prompts.text({
          message: 'Project directory',
          placeholder: 'my-app',
          defaultValue: 'my-app',
        }),
      );
    }
    options.framework ??= interactive
      ? await answer(
          prompts.select({
            message: 'Frontend framework',
            options: Object.entries(adapters).map(([value, adapter]) => ({
              value,
              label: adapter.label,
            })),
          }),
        )
      : 'next';
    let selected =
      options.features === 'none' ? [] : options.features?.split(',').map((name) => name.trim());
    if (!selected)
      selected = interactive
        ? await answer(
            prompts.multiselect({
              message: 'Optional features',
              required: false,
              options: Object.entries(features).map(([value, feature]) => ({
                value,
                label: feature.label,
              })),
            }),
          )
        : [];
    const plan = await planProject(directory, { ...options, features: selected });
    console.log(
      `\nProject: ${plan.target}\nFramework: ${plan.framework}\nFeatures: ${plan.features.join(', ') || 'none'}\nInstall: ${plan.install ? 'yes' : 'no'}\n`,
    );
    if (plan.framework === 'tanstack')
      console.log('Experimental: TanStack Start uses the nuqs Router adapter; upstream Start support is not guaranteed.\n');
    if (options.dryRun) return;
    try {
      await createApp(plan, { packagesDir: options.packagesDir });
    } catch (error) {
      throw new Error(
        `${error.message}\nNo existing project was overwritten. Any generated files remain at ${plan.target} for inspection.`,
        { cause: error },
      );
    }
    console.log(
      `\nCreated ${plan.target}\nNext: open this directory${plan.install ? '' : ', run npm install,'} and run npm run dev.\n`,
    );
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
