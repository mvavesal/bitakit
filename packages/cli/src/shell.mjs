import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

/** The replaceable part that frames every normal page: the app's shell. */
export const framePart = 'layout.app';

/**
 * One replaceable part as `describeSlots` reports it: the candidates an app can pick from, what
 * renders now and what `bitakit.config.ts` chooses. `exists` is false when no installed package or
 * plugin declares the part (an app without a frame).
 */
export function describeShell(slots, part = framePart) {
  const slot = slots.slots.find((entry) => entry.id === part);
  const selection = slot?.selection;
  return {
    part,
    exists: Boolean(slot),
    owner: slot?.owner ?? null,
    candidates: selection?.candidates ?? [],
    renders: selection?.renders ?? null,
    reason: selection?.reason ?? null,
    choice: selection?.choice ?? null,
  };
}

/** The short human listing of one part. */
export function formatShell(shell) {
  if (!shell.exists)
    return [
      `No "${shell.part}" part exists in this app.`,
      shell.part === framePart
        ? 'Install a shell such as @bitakit/shell, or write src/layouts/app.tsx.'
        : 'npx bitakit slots lists the parts this app has.',
    ];
  const fallback = shell.owner ? `the default of "${shell.owner}"` : 'the default';
  return [
    `${shell.part}`,
    `  renders     ${shell.renders ?? fallback}${shell.reason === 'ambiguous' ? ' (several candidates and no choice)' : shell.reason === 'choice-unavailable' ? ' (the choice names no candidate)' : ''}`,
    `  candidates  ${shell.candidates.length ? shell.candidates.join(', ') : 'none besides the default'}`,
    `  chosen      ${shell.choice ?? 'nothing in bitakit.config.ts'}`,
    '',
    `Use another:  npx bitakit shell use <name>${shell.part === framePart ? '' : ` --part ${shell.part}`}`,
    `The default:  npx bitakit shell reset${shell.part === framePart ? '' : ` --part ${shell.part}`}`,
  ];
}

/**
 * The candidate a name means: `plugin:variant` exactly, a plugin with one candidate, or a variant
 * that only one plugin offers. Throws with the candidates when the name fits none or several.
 */
export function resolveCandidate(candidates, name) {
  const matches = candidates.includes(name)
    ? [name]
    : candidates.filter((candidate) => {
        const [plugin, variant] = candidate.split(':');
        return plugin === name || variant === name;
      });
  if (matches.length === 1) return matches[0];
  const list = candidates.length ? candidates.join(', ') : 'none';
  throw new Error(
    matches.length
      ? `"${name}" fits several candidates: ${matches.join(', ')}. Name one exactly.`
      : `No candidate "${name}". Candidates: ${list}.`,
  );
}

const named = (node, name) =>
  ts.isPropertyAssignment(node) &&
  (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
  node.name.text === name;

/** The object literal of `export default { … }` or `export default defineBitaKit({ … })`. */
function configObject(file) {
  for (const statement of file.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals) continue;
    let expression = statement.expression;
    while (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    )
      expression = expression.expression;
    if (ts.isCallExpression(expression) && expression.arguments[0])
      expression = expression.arguments[0];
    if (ts.isObjectLiteralExpression(expression)) return expression;
  }
  return undefined;
}

/** `source` with `text` as the first property of `object`, on its own line when the object spans lines. */
function withFirstProperty(source, file, object, text) {
  const open = object.getStart(file) + 1;
  const first = object.properties[0];
  if (!first) return `${source.slice(0, open)} ${text} ${source.slice(object.getEnd() - 1)}`;
  const gap = source.slice(open, first.getStart(file));
  const lineBreak = gap.includes('\n');
  const indent = lineBreak ? gap.slice(gap.lastIndexOf('\n') + 1) : '';
  return lineBreak
    ? `${source.slice(0, open)}\n${indent}${text},${source.slice(open)}`
    : `${source.slice(0, open)} ${text},${source.slice(open)}`;
}

/** `source` without `property` of `object`, including the comma that belonged to it. */
function withoutProperty(source, file, object, property) {
  const index = object.properties.indexOf(property);
  const next = object.properties[index + 1];
  if (next) return source.slice(0, property.getStart(file)) + source.slice(next.getStart(file));
  const previous = object.properties[index - 1];
  const from = previous ? previous.getEnd() : object.getStart(file) + 1;
  // A trailing comma after the last property goes with it.
  const after = source.slice(property.getEnd());
  const comma = /^\s*,/.exec(after)?.[0].length ?? 0;
  const tail = source.slice(property.getEnd() + comma);
  // The only property: the braces close up again.
  return source.slice(0, from) + (previous ? tail : tail.trimStart());
}

/**
 * The text of a `bitakit.config.ts` with `choose[part]` set to `value`, or without it when `value`
 * is undefined (an emptied `choose` is removed too). Everything else stays as written. Returns
 * undefined when the file has no configuration object to edit, or `choose` is not an object
 * literal: then the line has to be written by hand.
 */
export function withChoice(source, part, value, fileName = 'bitakit.config.ts') {
  const parse = (text) =>
    ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const file = parse(source);
  const object = configObject(file);
  if (!object) return undefined;
  const choose = object.properties.find((property) => named(property, 'choose'));
  const entry = `'${part}': '${value}'`;
  if (!choose)
    return value === undefined
      ? source
      : withFirstProperty(source, file, object, `choose: { ${entry} }`);
  if (!ts.isObjectLiteralExpression(choose.initializer)) return undefined;
  const choices = choose.initializer;
  const current = choices.properties.find((property) => named(property, part));
  if (value !== undefined) {
    if (!current) return withFirstProperty(source, file, choices, entry);
    return (
      source.slice(0, current.initializer.getStart(file)) +
      `'${value}'` +
      source.slice(current.initializer.getEnd())
    );
  }
  if (!current) return source;
  if (choices.properties.length > 1) return withoutProperty(source, file, choices, current);
  return withoutProperty(source, file, object, choose);
}

/**
 * Writes the choice into the app's `bitakit.config.ts` (created when missing). Returns the file and
 * whether it changed; throws with the line to add when the file cannot be edited safely.
 */
export async function chooseCandidate(root, part, value) {
  const file = path.join(root, 'bitakit.config.ts');
  const source = await readFile(file, 'utf8').catch(() => undefined);
  if (source === undefined) {
    if (value === undefined) return { file, changed: false };
    await writeFile(
      file,
      `import { defineBitaKit } from '@bitakit/discovery';\n\nexport default defineBitaKit({ choose: { '${part}': '${value}' } });\n`,
    );
    return { file, changed: true };
  }
  const next = withChoice(source, part, value);
  if (next === undefined)
    throw new Error(
      value === undefined
        ? `bitakit.config.ts could not be edited. Remove '${part}' from its choose entry by hand.`
        : `bitakit.config.ts could not be edited. Add this to its configuration by hand: choose: { '${part}': '${value}' }`,
    );
  if (next !== source) await writeFile(file, next);
  return { file, changed: next !== source };
}
