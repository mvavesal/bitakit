#!/usr/bin/env node
// Builds the documentation diagrams. Each apps/docs/diagrams/<name>.html is the source, drawn with
// the diagram-design skill in the BitaKit profile (light skin, system fonts; see .diagram-design).
// This script derives the dark variant by swapping every light token for its dark one, exports
// both with the skill's own export_svg.py and copies the SVGs to the docs site and, for diagrams
// the README shows, to docs/assets/readme.
// Usage: node scripts/diagrams.mjs [name ...]
// Needs the skill: npx skills add cathrynlavery/diagram-design (or set DIAGRAM_DESIGN_SKILL).
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sources = path.join(root, 'apps/docs/diagrams');
const site = path.join(root, 'apps/docs/public/diagrams');
const readme = path.join(root, 'docs/assets/readme');
// Diagrams the root README shows, from GitHub, which cannot read the docs site's assets.
const readmeDiagrams = new Set(['layers']);

const skill =
  process.env.DIAGRAM_DESIGN_SKILL ?? path.join(homedir(), '.agents/skills/diagram-design');
const exporter = path.join(skill, 'scripts/export_svg.py');
if (!existsSync(exporter))
  throw new Error(
    `The diagram-design skill was not found at ${skill}. Install it with ` +
      '`npx skills add cathrynlavery/diagram-design` or set DIAGRAM_DESIGN_SKILL.',
  );

// BitaKit profile: light → dark. Every color in a source must be one of these.
const tokens = [
  ['#f6f8fa', '#0d1117'], // paper
  ['#eef2f6', '#151b23'], // paper-2
  ['#ffffff', '#151b23'], // node fill
  ['#122f4d', '#e6edf3'], // ink
  ['#4b6279', '#9bb1c8'], // muted
  ['#59636e', '#9198a1'], // soft
  ['#9a6700', '#ebb759'], // accent
  ['#1f5fa8', '#79a8e0'], // link
  ['#c9d3de', 'rgba(157,176,198,0.30)'], // rule-solid
  ['rgba(235,183,89,0.16)', 'rgba(235,183,89,0.12)'], // accent-tint
];
// Role colors at an opacity keep their alpha.
const tinted = [
  ['rgba(18,47,77,', 'rgba(230,237,243,'], // ink @ a
  ['rgba(75,98,121,', 'rgba(155,177,200,'], // muted @ a
  ['rgba(154,103,0,', 'rgba(235,183,89,'], // accent @ a
];

function darken(html, file) {
  const unknown = [...html.matchAll(/#[0-9a-fA-F]{6}\b|rgba\([^)]*\)/g)]
    .map(([color]) => color.toLowerCase())
    .filter(
      (color) =>
        !tokens.some(([light]) => light === color) &&
        !tinted.some(([light]) => color.startsWith(light)),
    );
  if (unknown.length)
    throw new Error(`${file} uses colors outside the BitaKit profile: ${[...new Set(unknown)]}`);
  let out = html.replace(/#[0-9a-fA-F]{6}\b|rgba\([^)]*\)/g, (color) => {
    const lower = color.toLowerCase();
    const token = tokens.find(([light]) => light === lower);
    if (token) return token[1];
    const tint = tinted.find(([light]) => lower.startsWith(light));
    return tint[1] + lower.slice(tint[0].length);
  });
  // Unique accessible-name IDs per variant, as the skill requires.
  const slug = path.basename(file, '.html');
  out = out.replaceAll(`${slug}-title`, `${slug}-dark-title`);
  out = out.replaceAll(`${slug}-desc`, `${slug}-dark-desc`);
  return out;
}

const only = process.argv.slice(2);
const names = (await readdir(sources))
  .filter((file) => file.endsWith('.html'))
  .map((file) => path.basename(file, '.html'))
  .filter((name) => !only.length || only.includes(name));
const work = await mkdtemp(path.join(tmpdir(), 'bitakit-diagrams-'));
await mkdir(site, { recursive: true });
try {
  for (const name of names) {
    const light = await readFile(path.join(sources, `${name}.html`), 'utf8');
    await writeFile(path.join(work, `${name}.html`), light);
    await writeFile(path.join(work, `${name}-dark.html`), darken(light, `${name}.html`));
    for (const [variant, file] of [
      ['light', `${name}.html`],
      ['dark', `${name}-dark.html`],
    ]) {
      const svg = path.join(work, `${name}-${variant}.svg`);
      execFileSync('python3', [exporter, path.join(work, file), svg, '--system-fonts'], {
        stdio: 'pipe',
      });
      await copyFile(svg, path.join(site, `${name}-${variant}.svg`));
      if (readmeDiagrams.has(name))
        await copyFile(svg, path.join(readme, `${name}-${variant}.svg`));
    }
    console.log(`${name}: light and dark`);
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
