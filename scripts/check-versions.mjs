#!/usr/bin/env node
// Every published @bitakit package shares one version, and internal dependencies use that release
// line. The generator installs the same version, so generated apps never mix releases.
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
const versions = new Set(published.map(({ manifest }) => manifest.version));
const problems = [];
if (versions.size !== 1)
  problems.push(
    `Packages use different versions: ${published.map(({ manifest }) => `${manifest.name}@${manifest.version}`).join(', ')}`,
  );
const [version] = versions;
for (const { file, manifest } of manifests)
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])
    for (const [name, range] of Object.entries(manifest[field] ?? {}))
      if (name.startsWith('@bitakit/') && range !== `^${version}`)
        problems.push(`${file}: ${field}.${name} is "${range}", expected "^${version}".`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`All ${published.length} @bitakit packages use ${version}.`);
