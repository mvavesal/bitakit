import path from 'node:path';
import { describeDefinitions } from './definition-info.mjs';

/**
 * Fields of a client Action (the button) that a server Action (the operation) never has. The
 * same list as Core's `ClientOnlyActionField`; Core rejects them again at startup.
 */
export const clientOnlyFields = [
  'enabled',
  'visible',
  'href',
  'dialog',
  'dialogSize',
  'confirm',
  'slots',
  'groups',
  'order',
  'dividerBefore',
  'shortcut',
  'icon',
  'tooltip',
  'variant',
  'checked',
  'value',
  'concurrency',
  'concurrencyKey',
  'success',
  'failure',
  'internal',
];
/** Fields only a server Action has; in a client Action they would silently not apply. */
export const serverOnlyFields = ['access', 'expose', 'output'];
/**
 * Name segments no server Action ID may use: as properties of `remote` they would make a
 * namespace thenable, observable or converting. A copy of Core's internal `reservedSegments`
 * (`src/remote.ts`); keep both lists equal.
 */
export const reservedSegments = [
  'then',
  'catch',
  'finally',
  'subscribe',
  'toJSON',
  'valueOf',
  'toString',
  'constructor',
  'prototype',
];

/** `true`/`false` for a boolean literal (also through a local const), `undefined` when absent. */
function booleanLiteral(node, { unwrap, ts }) {
  if (node === undefined) return undefined;
  const value = unwrap(node);
  if (value?.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value?.kind === ts.SyntaxKind.FalseKeyword) return false;
  return null;
}

/**
 * The server Actions of one module's `server/actions/**`, read statically. Every definition the
 * parser resolves must have `access`, no client-only field, `expose` as a boolean literal (or
 * none) and no reserved name segment; a violation is a generation error naming the file.
 * Returns `[{ id, key, file, entry, exposed }]` (`entry` is the discovered file, `key` the record
 * path inside it). Definitions the parser cannot resolve are left to Core's startup checks.
 */
export async function serverActionsOf(entries, { moduleId, relativeTo }) {
  const { definitions } = await describeDefinitions(entries, {
    helper: 'defineAction',
    moduleId,
    keys: true,
    inspect: (fields, helpers) => ({
      fields: [...fields.keys()],
      expose: booleanLiteral(fields.get('expose'), helpers),
    }),
  });
  const shown = (file) => path.relative(relativeTo, file).split(path.sep).join('/');
  const operations = [];
  for (const definition of definitions) {
    // A factory-form call has no readable fields; Core checks it at startup.
    if (!definition.fields) continue;
    const at = `${shown(definition.file)}: server:${definition.id}`;
    const clientField = clientOnlyFields.find((field) => definition.fields.includes(field));
    if (clientField)
      throw new Error(
        `${at} has the client-only field "${clientField}". The operation has no UI; that field belongs to the button in actions/, which calls remote.${definition.id}().`,
      );
    if (!definition.fields.includes('access'))
      throw new Error(
        `${at} needs access: 'public', 'user', 'organization' or { permission: { <resource>: ['<operation>'] } }.`,
      );
    if (definition.expose === null)
      throw new Error(
        `${at} has an expose that is not true or false. Write expose: true to call it from the browser, or leave it out.`,
      );
    const reserved = definition.id.split('.').find((segment) => reservedSegments.includes(segment));
    if (reserved !== undefined)
      throw new Error(
        `${at} uses the reserved name "${reserved}"; ${reservedSegments.join(', ')} cannot name a server Action, because remote would turn them into thenable, observable or converting objects. Rename the file (or its record key).`,
      );
    operations.push({
      id: definition.id,
      key: definition.key,
      file: definition.file,
      entry: entries.find((entry) => entry.file === definition.file),
      exposed: definition.expose === true,
    });
  }
  return operations;
}

/**
 * Client Actions (`actions/**`) with a server field (`access`, `expose`, `output`) are a
 * generation error: the file is the button, and the field would silently not apply. The same
 * message as Core's runtime check, which covers definitions the parser cannot resolve.
 */
export async function rejectServerFields(entries, { moduleId, relativeTo }) {
  const { definitions } = await describeDefinitions(entries, {
    helper: 'defineAction',
    moduleId,
    keys: true,
    inspect: (fields) => ({
      serverField: serverOnlyFields.find((field) => fields.has(field)),
    }),
  });
  for (const definition of definitions) {
    if (!definition.serverField) continue;
    const entry = entries.find((item) => item.file === definition.file);
    const local = [...(entry?.path ?? []), ...(definition.key ? definition.key.split('.') : [])];
    throw new Error(
      `${path.relative(relativeTo, definition.file).split(path.sep).join('/')}: \`${definition.serverField}\` is a server field. This file is the button; put the operation, with \`expose: true\`, in server/actions/${local.join('/') || 'index'}.ts and call it with remote.${definition.id}().`,
    );
  }
}
