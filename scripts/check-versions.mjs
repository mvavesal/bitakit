#!/usr/bin/env node
// Published @bitakit packages share one release line (0.2.x). Only changed packages get a patch
// release, so patch versions may differ. Internal dependencies use caret ranges the workspace
// satisfies, and create-app is never newer than another package: generated apps depend on
// `^<create-app version>` for every @bitakit package.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

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
      if (!current || !minimum || line(minimum) !== line(current) || compare(minimum, current) > 0)
        problems.push(
          `${file}: ${field}.${name} is "${range}"; expected a caret range that ${name}@${current} satisfies.`,
        );
    }
const generator = versionOf.get('@bitakit/create-app');
for (const [name, version] of versionOf)
  if (generator && compare(generator, version) > 0)
    problems.push(
      `@bitakit/create-app@${generator} is newer than ${name}@${version}; generated apps would depend on an unreleased version.`,
    );
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
const versions = [...new Set(versionOf.values())].sort(compare);
console.log(
  `All ${published.length} @bitakit packages are on the ${[...lines][0]}.x line (${versions.join(', ')}).`,
);
