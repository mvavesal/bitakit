import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {
  createInventory,
  pluginMembership,
  inventoryMetadata,
  projectPluginMetadata,
} from '@bitakit/core';
import { describeDefinitions } from '@bitakit/discovery';

const kinds = {
  services: 'service',
  actions: 'action',
  events: 'event',
  settings: 'setting',
  pages: 'page',
  slots: 'widget',
  slotDefinitions: 'slot',
  providers: 'provider',
  configs: 'config',
  interceptors: 'interceptor',
};

/** The literal keys of the first object passed to `helper(...)` in the default export. */
async function recordKeys(file, helper) {
  const tree = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let keys;
  const visit = (node) => {
    if (keys) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === helper &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const names = node.arguments[0].properties.map((item) =>
        item.name && !ts.isComputedPropertyName(item.name) ? item.name.text : undefined,
      );
      keys = names.includes(undefined) ? null : names;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return keys ?? null;
}

/**
 * The IDs one contribution file declares, derived statically with the runtime's naming rules:
 * Actions and services by path or record key, page URLs, slot targets, events and setting keys.
 * Returns `null` when the file cannot be read statically; the inventory then keeps the file.
 */
async function idsOf(kind, entry, module, { root, app, slotDeclarations }) {
  const file = path.join(root, entry.file);
  const segments = entry.path ? entry.path.split('.') : [];
  const prefix = app ? '' : module.id;
  const join = (...parts) => parts.filter(Boolean).join('.');
  if (kind === 'actions' || kind === 'services') {
    const { definitions, unresolved } = await describeDefinitions([{ ...entry, file }], {
      helper: kind === 'actions' ? 'defineAction' : 'defineService',
      moduleId: prefix,
    });
    return unresolved.length || !definitions.length ? null : definitions.map((item) => item.id);
  }
  if (kind === 'pages')
    return [`${app ? '' : `/${module.id}`}/${segments.join('/')}`.replace(/(.)\/$/, '$1')];
  if (kind === 'slots') return [segments.join('.')];
  if (kind === 'configs') return [module.id];
  if (kind === 'slotDefinitions')
    return slotDeclarations.filter((slot) => slot.file === entry.file).map((slot) => slot.id);
  if (kind === 'events') {
    const keys = await recordKeys(file, 'defineEvents');
    return keys && keys.map((key) => join(module.id, key));
  }
  if (kind === 'settings') {
    const keys = await recordKeys(file, 'defineSettings');
    return keys && keys.map((key) => join(prefix, key));
  }
  return null;
}

/**
 * Static source evidence only: IDs a file declares are resolved where they can be read without
 * running it; package plugins and dynamic files stay explicitly unresolved.
 */
export async function inspectionFromDescription(description) {
  const plugins = [];
  for (const module of [description.app, ...description.plugins]) {
    const app = module === description.app;
    const declarations = [];
    for (const [key, kind] of Object.entries(kinds))
      for (const entry of module[key] ?? []) {
        const ids = await idsOf(key, entry, module, {
          root: description.root,
          app,
          slotDeclarations: description.slotDeclarations,
        }).catch(() => null);
        if (ids?.length)
          for (const id of ids)
            declarations.push({ kind, id, source: entry.file, resolution: 'resolved' });
        else declarations.push({ kind, id: null, source: entry.file, resolution: 'file' });
      }
    plugins.push({
      id: module.id,
      pluginId: module.id,
      application: app,
      origin: module.origin?.kind ?? 'unknown',
      parent: module.parent ?? null,
      package: module.origin?.package ?? null,
      declaredMembership: module.origin?.memberOf ?? null,
      membership: pluginMembership(module.origin, {
        application: app,
        bundle: description.bundle,
        knownBundles: description.knownBundles,
      }),
      enabled: module.enabled ?? true,
      source: { kind: 'file', path: module.directory },
      metadata: inventoryMetadata(module.metadata),
      dependencies: module.dependencies ?? [],
      declarations,
    });
  }
  for (const specifier of description.packages) {
    const record = description.packagePlugins?.[specifier];
    plugins.push({
      id: specifier,
      pluginId: record?.pluginId ?? null,
      application: false,
      origin: record?.origin?.kind ?? 'unknown',
      parent: null,
      package: record?.origin?.package ?? null,
      declaredMembership: record?.origin?.memberOf ?? null,
      membership: pluginMembership(record?.origin, {
        bundle: description.bundle,
        knownBundles: description.knownBundles,
      }),
      enabled: description.catalogPackages?.includes(specifier) ? null : true,
      source: { kind: 'package', path: specifier },
      metadata: inventoryMetadata(
        projectPluginMetadata(record?.origin.metadata?.canonical, record?.origin.metadata?.legacy)
          .metadata,
      ),
      dependencies: null,
      declarations: null,
    });
  }
  return createInventory(plugins);
}
