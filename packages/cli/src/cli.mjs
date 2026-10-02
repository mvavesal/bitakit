#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { styleText } from 'node:util';
import { Command } from 'commander';
import { describeFoundation } from '@bitakit/core/discovery';
import { addContribution, addPlugin } from './add.mjs';
import { buildPlugin } from './build.mjs';
import { doctor } from './doctor.mjs';
import { findProject } from './project.mjs';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const relative = (file) => path.relative(process.cwd(), file) || '.';
const created = (files) => files.forEach((file) => console.log(`  ${styleText('green', '+')} ${relative(file)}`));

const program = new Command()
  .name('bitakit')
  .description('Add plugins and contributions to a BitaKit project, and check it for problems.')
  .version(manifest.version);

const add = program.command('add').description('Create a plugin or a contribution from a template.');
add
  .command('plugin')
  .argument('<name>', 'plugin name, for example "notes"')
  .option('--minimal', 'only a service and one action, without a page or navigation link')
  .description('Create src/plugins/<name> with a service, actions, a navigation link and a page.')
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
for (const kind of ['action', 'service', 'page'])
  add
    .command(kind)
    .argument('<target>', `"<plugin>/<name>" in an app, or "<name>" inside a plugin package`)
    .description(`Create a ${kind} file. Its ID comes from the file path.`)
    .action(async (target) => {
      const result = await addContribution(kind, target);
      console.log(`\nCreated ${kind} ${kind === 'page' ? result.path : `"${result.id}"`}:`);
      created(result.created);
      console.log('');
    });

program
  .command('build')
  .option('--check', 'only generate types and type-check, without writing dist')
  .description('Build a plugin package: types, compiled sources and the dist/foundation.js entry.')
  .action(async (options) => {
    const result = await buildPlugin({ check: options.check });
    const count = ['services', 'actions', 'pages'].map((kind) => `${result.module[kind].length} ${kind}`).join(', ');
    console.log(
      options.check
        ? `\nPlugin "${result.id}" type-checks (${count}).\n`
        : `\nBuilt plugin "${result.id}" (${count}) into ${relative(result.dist)}.\nPublish it with npm publish; apps that install it discover it automatically.\n`,
    );
  });

program
  .command('doctor')
  .description('Check versions, duplicate packages, routes, links, service names and styles.')
  .action(async () => {
    const { project, results } = await doctor();
    console.log(`\nBitaKit doctor · ${project.manifest.name ?? relative(project.root)}\n`);
    const symbols = { ok: styleText('green', '✔'), warn: styleText('yellow', '⚠'), error: styleText('red', '✖') };
    for (const result of results) {
      console.log(`${symbols[result.status]} ${result.title}`);
      for (const detail of result.details ?? []) console.log(`    ${detail}`);
      if (result.fix) console.log(`    ${styleText('cyan', 'Fix:')} ${result.fix.replaceAll('\n', '\n    ')}`);
    }
    const errors = results.filter((result) => result.status === 'error').length;
    const warnings = results.filter((result) => result.status === 'warn').length;
    console.log(`\n${errors ? `${errors} problem${errors === 1 ? '' : 's'}` : 'No problems'}${warnings ? `, ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}.\n`);
    if (errors) process.exitCode = 1;
  });

program
  .command('info')
  .description('List the plugins, actions, services and pages discovery finds.')
  .action(async () => {
    const project = await findProject();
    if (project.kind !== 'app') throw new Error('Run "bitakit info" inside an app.');
    const description = await describeFoundation(project.root);
    const print = (title, module) => {
      console.log(`\n${styleText('bold', title)} ${styleText('dim', module.directory)}`);
      for (const kind of ['services', 'actions', 'pages'])
        if (module[kind].length)
          console.log(`  ${kind}: ${module[kind].map((entry) => entry.path).join(', ')}`);
    };
    print('App', description.app);
    for (const plugin of description.plugins)
      print(`Plugin "${plugin.id}"${plugin.enabled ? '' : ' (disabled)'}`, plugin);
    if (description.packages.length)
      console.log(`\n${styleText('bold', 'Installed plugin packages')}\n  ${description.packages.map((entry) => entry.replace(/\/foundation$/, '')).join('\n  ')}`);
    console.log('');
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(styleText('red', error.message));
  process.exitCode = 1;
}
