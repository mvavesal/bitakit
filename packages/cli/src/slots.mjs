import path from 'node:path';
import { candidateNames, selectSingle } from '@bitakit/core';
import { describeDefinitions } from '@bitakit/discovery';

const objectHelpers = new Set(['object', 'strictObject', 'looseObject']);

/**
 * Keys of a `z.object({ ... })`/`v.object({ ... })` payload; any other schema keeps them unknown.
 * Nodes come from discovery's parser, so they are classified with its `ts`, not a local import.
 */
function payloadOf(fields, { unwrap, ts }) {
  if (!fields.has('payload')) return { payload: false, payloadKeys: [] };
  const schema = unwrap(fields.get('payload'));
  const callee =
    schema && ts.isCallExpression(schema)
      ? ts.isPropertyAccessExpression(schema.expression)
        ? schema.expression.name.text
        : ts.isIdentifier(schema.expression) && schema.expression.text
      : undefined;
  const shape = objectHelpers.has(callee) ? unwrap(schema.arguments[0]) : undefined;
  if (!shape || !ts.isObjectLiteralExpression(shape)) return { payload: true, payloadKeys: null };
  const keys = [];
  for (const item of shape.properties) {
    if (!item.name || ts.isComputedPropertyName(item.name))
      return { payload: true, payloadKeys: null };
    keys.push(item.name.text);
  }
  return { payload: true, payloadKeys: keys };
}

/**
 * Slot names of an Action's literal `slots` list; `resolved` is false when any entry is not
 * literal.
 */
function placementsOf(fields, { unwrap, literal, ts }) {
  if (!fields.has('slots')) return { placements: [], resolved: true };
  const list = unwrap(fields.get('slots'));
  if (!list || !ts.isArrayLiteralExpression(list)) return { placements: [], resolved: false };
  const placements = [];
  let resolved = true;
  for (const element of list.elements) {
    const object = unwrap(element);
    const slot =
      object && ts.isObjectLiteralExpression(object)
        ? object.properties.find(
            (item) =>
              (ts.isPropertyAssignment(item) || ts.isShorthandPropertyAssignment(item)) &&
              !ts.isComputedPropertyName(item.name) &&
              item.name.text === 'slot',
          )
        : undefined;
    const name = slot
      ? literal(ts.isPropertyAssignment(slot) ? slot.initializer : slot.name)
      : literal(element);
    if (name === undefined) resolved = false;
    else placements.push(name);
  }
  return { placements, resolved };
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Every slot the app knows, answering "where can I put this?": the owned contracts of the app,
 * its enabled plugins and installed packages (their derived `*.slots.json`), plus name hints from
 * package manifests and `bitakit.config.ts`; the same set doctor counts. Contributions come from
 * the app's own files only: `ui/slots` components and Actions whose literal `slots` place them.
 * Packages and `setup()` attach more at runtime. Nothing is executed; a field a file does not
 * state literally is `null` (unknown), and files that could not be read are listed in `unresolved`.
 * Contributions to IDs that are neither declared nor hinted are listed in `unknownTargets`.
 */
export async function describeSlots(description) {
  const modules = [
    description.app,
    ...description.plugins.filter((plugin) => plugin.enabled !== false),
  ];
  const absolute = (entries) =>
    (entries ?? []).map((entry) => ({ ...entry, file: path.join(description.root, entry.file) }));
  const relative = (file) => path.relative(description.root, file).split(path.sep).join('/');
  const moduleId = (module) => (module === description.app ? '' : module.id);
  const unresolved = new Set(description.unresolvedSlots ?? []);

  const owners = new Map();
  const payloads = new Map();
  for (const module of modules) {
    for (const entry of module.slotDefinitions ?? []) owners.set(entry.file, module.id);
    const { definitions } = await describeDefinitions(absolute(module.slotDefinitions), {
      helper: 'defineSlot',
      moduleId: moduleId(module),
      inspect: payloadOf,
    });
    for (const item of definitions) payloads.set(`${relative(item.file)}\0${item.id}`, item);
  }

  const contributions = new Map();
  const contribute = (slot, entry) =>
    contributions.set(slot, [...(contributions.get(slot) ?? []), entry]);
  for (const module of modules) {
    for (const entry of module.slots ?? [])
      contribute(entry.path, {
        kind: 'component',
        id: null,
        plugin: module.id,
        source: entry.file,
      });
    // Layout files are candidates for layout.<family>, keyed by their variant.
    for (const entry of module.layouts ?? [])
      contribute(`layout.${entry.family}`, {
        kind: 'component',
        id: null,
        plugin: module.id,
        key: entry.variant,
        source: entry.file,
      });
    const actions = await describeDefinitions(absolute(module.actions), {
      helper: 'defineAction',
      moduleId: moduleId(module),
      inspect: placementsOf,
    });
    actions.unresolved.forEach((file) => unresolved.add(relative(file)));
    for (const action of actions.definitions) {
      if (!action.resolved) unresolved.add(relative(action.file));
      for (const slot of new Set(action.placements))
        contribute(slot, {
          kind: 'action',
          id: action.id,
          plugin: module.id,
          source: relative(action.file),
        });
    }
  }

  const slots = (description.slotDeclarations ?? []).map((declaration) => {
    const local = owners.get(declaration.file);
    const details = payloads.get(`${declaration.file}\0${declaration.id}`);
    return {
      id: declaration.id,
      owner:
        local ??
        (description.installedPackages ?? []).find((name) =>
          declaration.file.startsWith(`${name}/`),
        ) ??
        declaration.plugin ??
        null,
      plugin: declaration.plugin ?? null,
      contract: true,
      accepts: declaration.accepts ?? null,
      policy: declaration.policy ?? null,
      // Package sidecars carry no payload description.
      payload: local !== undefined && details ? details.payload : null,
      payloadKeys: local !== undefined && details ? details.payloadKeys : null,
      source: local !== undefined ? declaration.file : null,
      contributions: contributions.get(declaration.id) ?? [],
    };
  });
  const declared = new Set(slots.map((slot) => slot.id));
  // Discovery declares layout families nobody else declares as app-owned single slots.
  for (const [id, entries] of contributions)
    if (id.startsWith('layout.') && !declared.has(id) && entries.some((entry) => entry.key)) {
      declared.add(id);
      slots.push({
        id,
        owner: description.app.id,
        plugin: description.app.id,
        contract: true,
        accepts: 'component',
        policy: 'single',
        payload: false,
        payloadKeys: [],
        source: entries[0].source,
        generated: true,
        contributions: entries,
      });
    }
  for (const id of description.slots ?? [])
    if (!declared.has(id)) {
      declared.add(id);
      slots.push({
        id,
        owner: null,
        plugin: null,
        contract: false,
        accepts: null,
        policy: null,
        payload: null,
        payloadKeys: null,
        source: null,
        contributions: contributions.get(id) ?? [],
      });
    }
  // A placement on a slot nobody declares renders nowhere; list it instead of dropping it.
  const unknownTargets = [...contributions]
    .filter(([slot]) => !declared.has(slot))
    .flatMap(([slot, entries]) => entries.map((entry) => ({ slot, ...entry })));

  // Group the app and its plugins first, then packages, then contract-less name hints.
  const order = [...modules.map((module) => module.id), ...(description.installedPackages ?? [])];
  const rank = (slot) => {
    const index = slot.contract ? order.indexOf(slot.owner) : -1;
    return index >= 0 ? index : order.length + (slot.contract ? 0 : 1);
  };
  // A single slot renders one candidate: report which, by the runtime's own rules, from files.
  for (const slot of slots)
    if (slot.policy === 'single') {
      const candidates = slot.contributions.filter((entry) => entry.kind === 'component');
      const selection = selectSingle(candidates, {
        choice: description.choose?.[slot.id],
        appId: description.app.id,
      });
      slot.selection = {
        candidates: candidates.map((entry) => candidateNames(entry)[1] ?? entry.plugin),
        renders: selection.selected
          ? (candidateNames(selection.selected)[1] ?? selection.selected.plugin)
          : null,
        reason: selection.reason ?? null,
        choice: description.choose?.[slot.id] ?? null,
      };
    }
  return {
    version: 1,
    slots: slots
      .map((slot, index) => ({ slot, index }))
      .sort((a, b) => rank(a.slot) - rank(b.slot) || a.index - b.index)
      .map(({ slot }) => slot),
    unresolved: [...unresolved],
    unknownTargets,
  };
}

/** One replaceable part: which candidate renders, or why the owner's default does. */
function selectionText({ renders, reason, candidates }) {
  if (renders) return `renders ${renders}`;
  if (reason === 'ambiguous')
    return `renders the default: choose one of ${candidates.join(', ')} in bitakit.config.ts`;
  if (reason === 'choice-unavailable') return 'renders the default: choose names no candidate';
  return 'renders the default';
}

/** The short human listing: one line per slot under its owner. */
export function formatSlots(result, { dim = (text) => text } = {}) {
  const lines = result.slots.length ? [] : ['No slots are declared.'];
  const width = Math.max(0, ...result.slots.map((slot) => slot.id.length));
  let group;
  for (const slot of result.slots) {
    // Only local declarations have a source file in the app.
    const title = !slot.contract
      ? 'Name hints without a slot contract'
      : slot.source
        ? `Plugin "${slot.owner}"`
        : `Package "${slot.owner}"`;
    if (title !== group) lines.push('', title);
    group = title;
    lines.push(
      `  ${slot.id.padEnd(width)}  ${(slot.accepts ?? 'unknown').padEnd(9)}  ${plural(slot.contributions.length, 'contribution')}${slot.selection ? `  ${selectionText(slot.selection)}` : ''}`,
    );
  }
  if (result.slots.length)
    lines.push(
      '',
      dim(
        "Contributions count this app's ui/slots files and Action slots; packages add theirs at runtime.",
      ),
      dim('Payload keys, sources and contributors: npx bitakit slots --json'),
    );
  if (result.unknownTargets?.length)
    lines.push(
      '',
      `${plural(result.unknownTargets.length, 'contribution')} to undeclared slots:`,
      ...result.unknownTargets.map(
        (entry) =>
          `  ${entry.slot}  ${entry.kind === 'action' ? `Action ${entry.id}` : 'component'}  ${entry.source}`,
      ),
    );
  if (result.unresolved.length)
    lines.push(
      '',
      `${plural(result.unresolved.length, 'file')} could not be read statically:`,
      ...result.unresolved.map((file) => `  ${file}`),
    );
  return lines;
}
