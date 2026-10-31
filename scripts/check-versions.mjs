#!/usr/bin/env node
// Published @bitakit packages share one release line (0.2.x). Only changed packages get a patch
// release, so patch versions may differ. Internal dependencies use caret ranges the workspace
// satisfies; peer minima may use a verified pending release on the same line. Generated apps
// depend on the release line (`^0.2.0`), so create-app may be newer
// than other packages. Pending changesets are checked too: a minor or major bump starts a new
// line, so it must list every published package; otherwise the Version packages pull request
// would split the line and fail this check only after it was merged.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPackages } from '@manypkg/get-packages';
import { readChangesets } from '@changesets/read';
import { readConfig } from '@changesets/config';
import { readPreState } from '@changesets/pre';
import { assembleReleasePlan } from '@changesets/assemble-release-plan';

const root = path.resolve(import.meta.dirname, '..');
const directories = (await readdir(path.join(root, 'packages'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, 'packages', entry.name));
const manifests = [];
for (const directory of directories) {
  const file = path.join(directory, 'package.json');
  const manifest = JSON.parse(await readFile(file, 'utf8').catch(() => 'null'));
  if (manifest) manifests.push({ file: path.relative(root, file), manifest });
}
const published = manifests.filter(({ manifest }) => !manifest.private);
const versionOf = new Map(published.map(({ manifest }) => [manifest.name, manifest.version]));
let plannedVersions;
// A new optional entry can require an export shipping in the same release. Keep its peer
// minimum truthful now. Use Changesets' planner directly: status also compares Git history,
// which is unavailable in shallow detached PR checkouts and source archives.
async function plannedVersion(name) {
  if (!plannedVersions) {
    const packages = await getPackages(root);
    const { config, warnings, errors } = await readConfig(root, packages);
    for (const warning of warnings) console.warn(warning);
    if (errors?.length) throw new Error(`Invalid Changesets configuration:\n${errors.join('\n')}`);
    const changesets = await readChangesets(root);
    const plan = assembleReleasePlan(changesets, packages, config, await readPreState(root));
    plannedVersions = new Map(plan.releases.map((release) => [release.name, release.newVersion]));
  }
  return plannedVersions.get(name);
}
const parse = (version) => version.split('.').map(Number);
const line = (version) => {
  const [major, minor] = parse(version);
  return major === 0 ? `0.${minor}` : `${major}`;
};
const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const problems = [];
const lines = new Set(published.map(({ manifest }) => line(manifest.version)));
if (lines.size !== 1)
  problems.push(
    `Packages use different release lines: ${published.map(({ manifest }) => `${manifest.name}@${manifest.version}`).join(', ')}`,
  );
for (const { file, manifest } of manifests)
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ])
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (!name.startsWith('@bitakit/')) continue;
      const current = versionOf.get(name);
      const minimum = /^\^(\d+\.\d+\.\d+)$/.exec(range)?.[1];
      const pending =
        field === 'peerDependencies' && current && minimum && compare(minimum, current) > 0
          ? await plannedVersion(name)
          : undefined;
      const available = pending ?? current;
      if (
        !current ||
        !minimum ||
        line(minimum) !== line(current) ||
        compare(minimum, available) > 0
      )
        problems.push(
          `${file}: ${field}.${name} is "${range}"; expected a caret range that ${name}@${available} satisfies${pending ? ' in the pending Changesets release' : ''}.`,
        );
    }
const changesets = path.join(root, '.changeset');
for (const name of (await readdir(changesets)).filter(
  (file) => file.endsWith('.md') && file !== 'README.md',
)) {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(
    await readFile(path.join(changesets, name), 'utf8'),
  )?.[1];
  const bumps = new Map(
    (frontmatter ?? '')
      .split('\n')
      .map((entry) => /^\s*['"]?([^'":]+)['"]?\s*:\s*(patch|minor|major)\s*$/.exec(entry))
      .filter(Boolean)
      .map(([, pkg, bump]) => [pkg, bump]),
  );
  const raising = [...bumps].filter(([, bump]) => bump !== 'patch');
  const everyPackage =
    published.every(({ manifest }) => bumps.get(manifest.name) === raising[0]?.[1]) &&
    raising.length === bumps.size;
  if (raising.length && !everyPackage)
    problems.push(
      `.changeset/${name}: ${raising.map(([pkg, bump]) => `${pkg} ${bump}`).join(', ')} would leave the ${[...lines][0]}.x line for some packages only. Use patch; a new release line is one changeset that lists every published package as minor.`,
    );
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
const versions = [...new Set(versionOf.values())].sort(compare);
console.log(
  `All ${published.length} @bitakit packages are on the ${[...lines][0]}.x line (${versions.join(', ')}).`,
);
