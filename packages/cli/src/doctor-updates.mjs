import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import semver from 'semver';
import { detect, resolveCommand } from 'package-manager-detector';
import { appDevelopmentSkillPaths, cliVersion, inspectSkillCopy } from './agent-skill.mjs';
import { findProjectRoot } from './project.mjs';

const sections = ['dependencies', 'devDependencies', 'optionalDependencies'];
const official = (name) => name.startsWith('@bitakit/');

async function installedPackage(root, name) {
  try {
    const file = createRequire(path.join(root, 'package.json')).resolve(`${name}/package.json`);
    return { file, manifest: JSON.parse(await readFile(file, 'utf8')) };
  } catch {
    return undefined;
  }
}

/** Read-only registry checks for Doctor. The standard updater owns registry/auth and peer filtering. */
export async function checkUpdates({ cwd, lookup } = {}) {
  const project = await findProjectRoot(cwd);
  const manager = await detect({
    cwd: project.root,
    strategies: ['packageManager-field', 'devEngines-field', 'lockfile', 'install-metadata'],
  });
  const dependencies = Object.assign({}, ...sections.map((section) => project.manifest[section]));
  const packages = await Promise.all(
    Object.entries(dependencies)
      .filter(([name]) => official(name))
      .map(async ([name, range]) => {
        const installed = await installedPackage(project.root, name);
        return {
          name,
          range,
          installed: installed?.manifest.version ?? null,
          latest: null,
          candidate: null,
          status: 'unknown',
        };
      }),
  );
  const skills = await Promise.all(
    appDevelopmentSkillPaths.map(async (file) => ({
      file,
      ...(await inspectSkillCopy(path.dirname(path.join(project.root, file)))),
    })),
  );
  const report = {
    project: project.manifest.name,
    root: project.root,
    manager: manager ?? null,
    supportedManager: Boolean(manager && ['npm', 'pnpm', 'yarn', 'bun'].includes(manager.name)),
    runningCli: cliVersion,
    packages,
    skills,
    checkedAt: new Date().toISOString(),
    notes: [],
  };
  if (!report.supportedManager) {
    report.notes.push(
      'Package manager is unknown or unsupported; no registry requests or updates were made.',
    );
    return report;
  }
  // Include the executing CLI even when it came from npx rather than this project's dependencies.
  if (!packages.some(({ name }) => name === '@bitakit/cli'))
    packages.push({
      name: '@bitakit/cli',
      range: `~${cliVersion}`,
      installed: null,
      running: cliVersion,
      latest: null,
      candidate: null,
      status: 'unknown',
      external: true,
    });
  const eligible = packages.filter((item) => semver.validRange(item.range));
  for (const item of packages.filter((item) => !eligible.includes(item)))
    item.status = 'unsupported-spec';
  const data = {
    ...project.manifest,
    dependencies: {
      ...dependencies,
      ...Object.fromEntries(
        eligible.filter((item) => item.external).map((item) => [item.name, item.range]),
      ),
    },
  };
  const run = lookup ?? (await import('npm-check-updates')).run;
  const common = {
    cwd: project.root,
    packageFile: path.join(project.root, 'package.json'),
    packageData: data,
    packageManager: manager.name,
    dep: 'prod,dev,optional',
    filter: eligible.map(({ name }) => name),
    upgrade: false,
    install: 'never',
    interactive: false,
    cache: false,
    retry: 0,
    timeout: 10000,
    silent: true,
    jsonUpgraded: true,
    configFileName: '.bitakit-unused-ncu-config',
  };
  try {
    const observed = new Map();
    await run({
      ...common,
      target: 'latest',
      peer: false,
      filterResults: (name, result) => {
        observed.set(name, result.upgradedVersion);
        return true;
      },
    });
    const ranged = new Map();
    const upgrades = await run({
      ...common,
      target: 'semver',
      peer: true,
      filter: Object.keys(dependencies).concat(eligible.map(({ name }) => name)),
      filterResults: (name, result) => {
        if (!ranged.has(name) || semver.gt(result.upgradedVersion, ranged.get(name)))
          ranged.set(name, result.upgradedVersion);
        return eligible.some((item) => item.name === name);
      },
    });
    for (const item of eligible) {
      item.latest = observed.get(item.name) ?? null;
      if (!item.latest || !ranged.has(item.name)) continue;
      item.rangeLatest = ranged.get(item.name);
      const candidate = semver.minVersion(upgrades?.[item.name] ?? item.range)?.version;
      const current = item.installed ?? item.running;
      item.candidate = candidate && current && semver.gt(current, candidate) ? current : candidate;
      item.status =
        item.candidate && current && semver.gt(item.candidate, current) ? 'update' : 'current';
      if (!current) item.status = 'not-installed';
    }
    report.notes.push(
      'Candidates satisfy declared ranges and npm-check-updates peer filtering; they are not a guarantee that the complete installed graph or application is compatible. The package manager and project checks remain authoritative.',
    );
    if (eligible.some(({ status }) => status === 'unknown'))
      report.notes.push(
        'Some registry results are unavailable; offline, authentication or registry failures must not be interpreted as up to date.',
      );
  } catch {
    report.notes.push(
      'Update lookup did not complete. Check connectivity, registry access and authentication; no project files were changed.',
    );
  }
  return report;
}

/** Native package-manager upgrades retain ranges; broad ranges need an explicit migration decision. */
export function updateCommand(report) {
  const selected = report.packages.filter((item) => item.status === 'update' && !item.external);
  for (const item of selected) {
    if (item.rangeLatest && semver.gt(item.rangeLatest, item.candidate))
      throw new Error(
        `${item.name}: the native range update may select a peer-incompatible version. Resolve the peer constraints before updating.`,
      );
    const current = semver.parse(item.installed);
    const line =
      current.major === 0 ? `~${current.major}.${current.minor}.0` : `^${current.major}.0.0`;
    if (!semver.subset(item.range, line))
      throw new Error(
        `${item.name}: ${item.range} permits another release line. Narrow the project constraint explicitly before updating.`,
      );
  }
  if (!selected.length) return null;
  const specs = selected.map((item) =>
    report.manager.agent === 'yarn@berry' ? `${item.name}@${item.range}` : item.name,
  );
  const command = resolveCommand(report.manager.agent, 'upgrade', specs);
  if (!command) throw new Error('This package manager has no supported upgrade command.');
  if (report.manager.name === 'npm') command.args.push('--strict-peer-deps');
  if (report.manager.name === 'pnpm') command.args.push('--strict-peer-dependencies');
  return command;
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['inherit', 'ignore', 'ignore'],
      shell: false,
    });
    child.once('error', () =>
      reject(
        new Error(
          `Could not start ${command}; check that the project package manager is installed.`,
        ),
      ),
    );
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${command} failed (exit ${code}). Inspect the package manager's local logs and project diff before retrying. Agent files were not refreshed.`,
            ),
          ),
    );
  });
}

/** Explicit mutation only. Never rewrites custom skills or updates a shared/global CLI. */
export async function updatePackages({ cwd, check = checkUpdates, execute = runCommand } = {}) {
  const report = await check({ cwd });
  if (!report.supportedManager || report.packages.some(({ status }) => status === 'unknown'))
    throw new Error(
      'Update check is incomplete; no packages or agent files were changed. Run doctor --check-updates first.',
    );
  const command = updateCommand(report);
  if (command) await execute(command.command, command.args, report.root);
  for (const item of report.packages)
    item.installedAfter =
      (await installedPackage(report.root, item.name))?.manifest.version ?? null;
  const local = await installedPackage(report.root, '@bitakit/cli');
  if (!local) {
    report.notes.push(
      'No project-local CLI is installed. The external/global CLI and agent files were preserved; rerun with the desired compatible CLI version to refresh them using init --update-agent-files.',
    );
  } else {
    await execute(
      process.execPath,
      [path.join(path.dirname(local.file), 'src/cli.mjs'), 'init', '--update-agent-files'],
      report.root,
    );
    report.skills = await Promise.all(
      appDevelopmentSkillPaths.map(async (file) => ({
        file,
        ...(await inspectSkillCopy(path.dirname(path.join(report.root, file)))),
      })),
    );
    report.notes.push(
      'The project-local CLI ran init --update-agent-files. Edited skills are preserved. Run project tests and Doctor after the update.',
    );
  }
  report.updated = Boolean(command);
  report.notes.push(
    'Registry candidates above describe the pre-update check; installedAfter records the local result without another registry lookup.',
  );
  return report;
}

export function formatUpdates(report) {
  return [
    `BitaKit updates · running CLI ${report.runningCli} · package manager ${report.manager?.agent ?? 'unknown'}`,
    ...report.packages.map(
      (item) =>
        `${item.name}: installed ${item.installed ?? (item.running ? `external CLI ${item.running}` : 'missing')}; latest ${item.latest ?? 'unknown'}; range/peer-filtered candidate ${item.candidate ?? 'unknown'} (${item.status})${'installedAfter' in item ? `; installed after update ${item.installedAfter ?? 'missing'}` : ''}`,
    ),
    ...report.skills.map(
      (item) =>
        `${item.file}: ${item.state}${item.version ? ` (CLI ${item.version})` : ''}; compared with running CLI ${report.runningCli}`,
    ),
    ...report.notes,
  ].join('\n');
}
