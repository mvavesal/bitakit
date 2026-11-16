import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** The file that makes a folder a template. It is read, never copied into the project. */
export const templateManifest = 'bitakit.template.json';

const manifestKeys = [
  'name',
  'description',
  'frameworks',
  'features',
  'dependencies',
  'devDependencies',
  'env',
  'next',
];
/** Files the generator owns: a template adds packages through its manifest and rules through plugin guides. */
const reserved = ['package.json', 'AGENTS.md', 'CLAUDE.md'];
const skipped = new Set(['node_modules', '.git']);

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const stringRecord = (value) =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

/**
 * A template is a starting point for a new app: plugin folders and other files, the packages they
 * need and the environment values they read. It is a folder with `bitakit.template.json`; every
 * other file in it is copied into the project at the same path and wins over the generator's
 * starter file there. Reads and checks the manifest; nothing is written.
 */
export async function readTemplate(source) {
  const directory = path.resolve(source);
  const file = path.join(directory, templateManifest);
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    throw new Error(`No template at ${directory}: it needs a ${templateManifest}.`);
  }
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error.message}`);
  }
  if (!isRecord(manifest)) throw new Error(`${file} must hold an object.`);
  const unknown = Object.keys(manifest).filter((key) => !manifestKeys.includes(key));
  if (unknown.length)
    throw new Error(
      `${file}: unknown ${unknown.length === 1 ? 'key' : 'keys'} ${unknown.join(', ')}. Possible: ${manifestKeys.join(', ')}.`,
    );
  if (typeof manifest.name !== 'string' || !manifest.name.trim())
    throw new Error(`${file}: "name" is required.`);
  const check = (key, valid, expected) => {
    if (manifest[key] !== undefined && !valid(manifest[key]))
      throw new Error(`${file}: "${key}" must be ${expected}.`);
  };
  check('description', (value) => typeof value === 'string', 'a text');
  check('frameworks', strings, 'a list of framework names');
  check('features', strings, 'a list of feature names');
  check('dependencies', stringRecord, 'an object of package names and versions');
  check('devDependencies', stringRecord, 'an object of package names and versions');
  check('env', stringRecord, 'an object of names and example values');
  check('next', strings, 'a list of lines');
  const files = await templateFiles(directory);
  const owned = files.filter((name) => reserved.includes(name));
  if (owned.length)
    throw new Error(
      `The template "${manifest.name}" contains ${owned.join(', ')}. The generator owns these files: add packages through "dependencies" in ${templateManifest} and rules through a plugin's own AGENTS.md.`,
    );
  return {
    directory,
    name: manifest.name.trim(),
    description: manifest.description ?? '',
    frameworks: manifest.frameworks ?? [],
    features: manifest.features ?? [],
    dependencies: manifest.dependencies ?? {},
    devDependencies: manifest.devDependencies ?? {},
    env: manifest.env ?? {},
    next: manifest.next ?? [],
    files,
  };
}

/** Every regular file of the template, as a path relative to it; links and dependency folders are left out. */
async function templateFiles(directory, prefix = '') {
  const found = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (!skipped.has(entry.name)) found.push(...(await templateFiles(directory, relative)));
    } else if (entry.isFile() && relative !== templateManifest) found.push(relative);
  }
  return found.sort();
}

/** What stops a template from fitting the planned app, as a message; undefined when it fits. */
export function templateMismatch(template, { framework, features }) {
  if (template.frameworks.length && !template.frameworks.includes(framework))
    return `The template "${template.name}" is made for ${template.frameworks.join(' or ')}, not ${framework}. Choose it with --framework.`;
  const missing = template.features.filter((feature) => !features.includes(feature));
  if (missing.length)
    return `The template "${template.name}" needs the ${missing.length === 1 ? 'feature' : 'features'} ${missing.join(', ')}. Add ${missing.length === 1 ? 'it' : 'them'} to --features.`;
  return undefined;
}

/**
 * Copies the template into the freshly generated app at `target`: its files (over the generator's
 * starter files), its packages into `package.json` (a version the app already has stays) and its
 * environment names into `.env.example`. Returns the copied paths.
 */
export async function applyTemplate(target, template) {
  for (const relative of template.files) {
    const destination = path.join(target, relative);
    // A link in the way would write outside the project.
    const present = await lstat(destination).catch(() => undefined);
    if (present?.isSymbolicLink())
      throw new Error(
        `${relative} is a link in the project; the template does not write through it.`,
      );
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(template.directory, relative), destination);
  }
  const manifestPath = path.join(target, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const field of ['dependencies', 'devDependencies']) {
    const added = Object.entries(template[field]).filter(([name]) => !manifest[field]?.[name]);
    if (added.length) manifest[field] = { ...manifest[field], ...Object.fromEntries(added) };
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const names = Object.keys(template.env);
  if (names.length) {
    const file = path.join(target, '.env.example');
    const current = await readFile(file, 'utf8').catch(() => '');
    const known = new Set(current.split('\n').map((line) => line.split('=')[0].trim()));
    const lines = names
      .filter((name) => !known.has(name))
      .map((name) => `${name}=${template.env[name]}`);
    if (lines.length)
      await writeFile(
        file,
        `${current && !current.endsWith('\n') ? `${current}\n` : current}${lines.join('\n')}\n`,
      );
  }
  return template.files;
}
