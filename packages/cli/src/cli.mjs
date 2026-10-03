#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { styleText } from 'node:util';
import { Command } from 'commander';
import {
  describeFoundation,
  generateFoundation,
  migrateProject,
  watchFoundation,
} from '@bitakit/discovery';
import { addContribution, addPlugin, contributionKinds } from './add.mjs';
import { buildPlugin } from './build.mjs';
import { doctor } from './doctor.mjs';
import { initProject } from './init.mjs';
import { findProject, findProjectRoot } from './project.mjs';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const relative = (file) => path.relative(process.cwd(), file) || '.';
const created = (files) =>
  files.forEach((file) => console.log(`  ${styleText('green', '+')} ${relative(file)}`));

const program = new Command()
  .name('bitakit')
  .description(
    'Wire an app, add plugins and contributions, generate the wiring, and check a project for problems.',
  )
  .version(manifest.version);

const add = program
  .command('add')
  .description('Create a plugin or a contribution from a template.');
add
  .command('plugin')
  .argument('<name>', 'plugin name, for example "notes"')
  .option(
    '--minimal',
    'only a service, its events and one action, without a page or navigation link',
  )
  .description(
    'Create src/plugins/<name> with a service, events, actions, a navigation link and a page.',
  )
  .action(async (name, options) => {
    const result = await addPlugin(name, { minimal: options.minimal });
    console.log(`\nCreated plugin "${name}":`);
    created(result.created);
    console.log(
      result.path
        ? `\n"${result.title}" now appears in the navigation and opens ${result.path}.\nThe dev server picks it up automatically; no registration needed.\n`
        : `\nThe dev server picks it up automatically; no registration needed.\n`,
    );
  });
for (const kind of contributionKinds)
  add
    .command(kind)
    .argument(
      kind === 'events' || kind === 'settings'
        ? '[plugin]'
        : kind === 'layout'
          ? '<name>'
          : '<target>',
      kind === 'events' || kind === 'settings'
        ? `the plugin that declares the ${kind}; omit it inside a plugin package`
        : kind === 'layout'
          ? 'the layout name; pages choose it with export const layout'
          : `"<plugin>/<name>" in an app (nested names allowed), or "<name>" inside a plugin package`,
    )
    .description(
      kind === 'events' || kind === 'settings'
        ? `Create the ${kind}.ts of a plugin.`
        : kind === 'layout'
          ? 'Create src/layouts/<name>.tsx of the app.'
          : `Create a ${kind} file. Its ID comes from the file path.`,
    )
    .action(async (target) => {
      const result = await addContribution(kind, target);
      console.log(`\nCreated ${kind} ${kind === 'page' ? result.path : `"${result.id}"`}:`);
      created(result.created);
      console.log('');
    });

program
  .command('init')
  .description(
    'Wire an existing Next.js or TanStack Start app: bitakit.config.ts, the config wrapper or Vite plugin, the provider, the catch-all route and .gitignore.',
  )
  .action(async () => {
    const { written, skipped, install } = await initProject();
    if (written.length) {
      console.log('\nWritten:');
      for (const { file, created } of written)
        console.log(`  ${styleText('green', created ? '+' : '~')} ${relative(file)}`);
    }
    if (skipped.length) {
      console.log('\nSkipped:');
      for (const { file, reason } of skipped)
        console.log(
          `  ${styleText('yellow', '-')} ${relative(file)} ${styleText('dim', `(${reason})`)}`,
        );
    }
    if (!written.length) console.log('\nNothing to write: the app is already wired.');
    if (install.length)
      console.log(`\nInstall the packages the wiring imports:\n  npm install ${install.join(' ')}`);
    console.log('\nThen run "npx bitakit generate" and "npx bitakit doctor".\n');
  });

program
  .command('generate')
  .option('--watch', 'keep regenerating while files change')
  .description('Write src/bitakit.gen.* from the plugin folders and installed packages.')
  .action(async (options) => {
    const project = await findProject();
    if (project.kind !== 'app') throw new Error('Run "bitakit generate" inside an app.');
    if (options.watch) {
      watchFoundation(project.root, (error) =>
        console.error(styleText('red', String(error?.message ?? error))),
      );
      console.log(`Watching ${relative(project.root)} for changes…`);
      await new Promise(() => {});
    }
    const result = await generateFoundation(project.root);
    console.log(
      `\nGenerated ${relative(result.generated)} (${result.framework === 'none' ? 'no framework provider' : result.framework}).${result.warnings.length ? ` ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'} above.` : ''}\n`,
    );
  });

program
  .command('migrate')
  .option('--dry-run', 'only list the changes')
  .description(
    'Rewrite a 0.1 project to the current layout: bitakit.config.ts, folder-only files, ui/ folders, generated imports.',
  )
  .action(async (options) => {
    // Only the root is needed: a 0.1 configuration may not even load before it is migrated.
    const { root } = await findProjectRoot();
    const { changes } = await migrateProject(root, { dryRun: options.dryRun });
    if (!changes.length) {
      console.log('\nNothing to migrate.\n');
      return;
    }
    console.log(options.dryRun ? '\nWould change:' : '\nChanged:');
    for (const change of changes)
      console.log(
        `  ${styleText(change.kind === 'skip' ? 'yellow' : 'green', change.kind.padEnd(7))} ${change.from}${change.to ? ` → ${change.to}` : ''}${change.detail ? styleText('dim', `  (${change.detail})`) : ''}`,
      );
    console.log(
      options.dryRun
        ? '\nRun without --dry-run to apply.\n'
        : '\nReview the diff, then run "bitakit generate" and "bitakit doctor".\n',
    );
  });

program
  .command('build')
  .option('--check', 'only generate types and type-check, without writing dist')
  .description('Build a plugin package: types, compiled sources and the dist/plugin.js entry.')
  .action(async (options) => {
    const result = await buildPlugin({ check: options.check });
    const count = ['services', 'actions', 'pages']
      .map((kind) => `${result.module[kind].length} ${kind}`)
      .join(', ');
    console.log(
      options.check
        ? `\nPlugin "${result.id}" type-checks (${count}).\n`
        : `\nBuilt plugin "${result.id}" (${count}) into ${relative(result.dist)}.\nPublish it with npm publish; apps that install it discover it automatically.\n`,
    );
  });

program
  .command('doctor')
  .option('--json', 'machine-readable output')
  .description(
    'Check versions, wiring, routes, links, service names, styles and deprecated layouts.',
  )
  .action(async (options) => {
    const { project, results } = await doctor();
    const errors = results.filter((result) => result.status === 'error').length;
    const warnings = results.filter((result) => result.status === 'warn').length;
    if (options.json) {
      console.log(
        JSON.stringify({ project: project.manifest.name, results, errors, warnings }, null, 2),
      );
      if (errors) process.exitCode = 1;
      return;
    }
    console.log(`\nBitaKit doctor · ${project.manifest.name ?? relative(project.root)}\n`);
    const symbols = {
      ok: styleText('green', '✔'),
      warn: styleText('yellow', '⚠'),
      error: styleText('red', '✖'),
    };
    for (const result of results) {
      console.log(`${symbols[result.status]} ${result.title}`);
      for (const detail of result.details ?? []) console.log(`    ${detail}`);
      if (result.fix)
        console.log(`    ${styleText('cyan', 'Fix:')} ${result.fix.replaceAll('\n', '\n    ')}`);
    }
    console.log(
      `\n${errors ? `${errors} problem${errors === 1 ? '' : 's'}` : 'No problems'}${warnings ? `, ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}.\n`,
    );
    if (errors) process.exitCode = 1;
  });

program
  .command('info')
  .option('--json', 'machine-readable output')
  .description('List the plugins, services, actions, events and pages discovery finds.')
  .action(async (options) => {
    const project = await findProject();
    if (project.kind !== 'app') throw new Error('Run "bitakit info" inside an app.');
    const description = await describeFoundation(project.root);
    if (options.json) {
      console.log(JSON.stringify(description, null, 2));
      return;
    }
    const print = (title, module) => {
      console.log(`\n${styleText('bold', title)} ${styleText('dim', module.directory)}`);
      for (const kind of [
        'services',
        'actions',
        'events',
        'pages',
        'slots',
        'interceptors',
        'configs',
      ])
        if (module[kind]?.length)
          console.log(
            `  ${kind}: ${module[kind].map((entry) => entry.path || (kind === 'events' ? 'events.ts' : '/')).join(', ')}`,
          );
    };
    print('App', description.app);
    for (const plugin of description.plugins)
      print(`Plugin "${plugin.id}"${plugin.enabled ? '' : ' (disabled)'}`, plugin);
    if (description.installedPackages.length)
      console.log(
        `\n${styleText('bold', 'Installed plugin packages')}\n  ${description.installedPackages.join('\n  ')}`,
      );
    if (description.warnings.length) {
      console.log(
        `\n${styleText('yellow', `${description.warnings.length} warning${description.warnings.length === 1 ? '' : 's'}`)}`,
      );
      for (const warning of description.warnings) console.log(`  ${warning}`);
    }
    console.log('');
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(styleText('red', error.message));
  process.exitCode = 1;
}
