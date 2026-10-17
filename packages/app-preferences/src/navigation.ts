import {
  ActionGroup,
  scopeLifecycle,
  type SlotAttachment,
  destinationMetadata,
  type ActionDefinition,
  type ActionIcon,
  type PluginScope,
  type ScopeTranslation,
} from '@bitakit/core';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import SettingIcon from 'reicon-react/icons/Setting';
import { settingsCatalog, visibleSections, type SettingsCatalogModule } from './catalog.js';
import { SettingsBody } from './components/settings-body.js';
import { pluginId } from './id.js';
import { sectionHref } from './paths.js';
import { categoryTitle, message } from './text.js';

export type SettingsNavigationProjection = {
  readonly modules: readonly SettingsCatalogModule[];
  readonly appId: string;
  /** The host translation from `scopeTranslation(scope)`; projections re-sync when it changes. */
  readonly translation: ScopeTranslation;
  readonly basePath: string;
  /** Action groups the "Settings" entry joins. */
  readonly groups: readonly string[];
  readonly slots?: readonly string[];
};
type Target = ReturnType<PluginScope['actions']['getGroup']>;
type Registration = { handle: ReturnType<Target['add']>; groups: string };

const groupKey = (groups: readonly ActionGroup[] = []) =>
  groups.map((group) => `${group.id}\u0000${group.title ?? ''}`).join('\u0001');
// Category names are free text; group IDs are not.
const groupId = (prefix: string, name: string) =>
  `${prefix}.${name.replace(/[^a-zA-Z0-9._:/-]+/g, '-')}`;

/**
 * Keeps one registration per Action ID in a scope group. An update must not replace the groups
 * (that would drop the scope group), so a changed group title registers the Action again.
 */
function registry(target: Target) {
  const registrations = new Map<string, Registration>();
  return {
    sync(definitions: readonly ActionDefinition[]) {
      const ids = new Set(definitions.map((definition) => definition.id));
      for (const [id, registration] of registrations)
        if (!ids.has(id)) {
          registration.handle.dispose();
          registrations.delete(id);
        }
      for (const definition of definitions) {
        const groups = groupKey(definition.groups);
        const existing = registrations.get(definition.id);
        if (existing?.groups === groups) {
          const { id: _id, groups: _groups, ...patch } = definition;
          existing.handle.update(patch);
          continue;
        }
        existing?.handle.dispose();
        registrations.set(definition.id, { handle: target.add(definition), groups });
      }
    },
    dispose() {
      for (const registration of registrations.values()) registration.handle.dispose();
      registrations.clear();
    },
  };
}

/**
 * Projects the settings catalog into URL Actions so navigation and search find every page:
 * one `settings.section.<id>` per visible section (group `settings.pages`, headed by its
 * `settings.category.<id>`, with the section's `shortcut`), the `app-preferences.settings`
 * entry in the configured groups and
 * one `settings.plugins.<id>` per plugin linking to its view in the plugin overview. Titles
 * follow the translator; every registration leaves with the plugin.
 */
export function bindSettingsNavigation(
  scope: PluginScope,
  { modules, appId, translation, basePath, groups, slots }: SettingsNavigationProjection,
): () => void {
  const lifecycle = scopeLifecycle(scope);
  let closed = false;
  const projections = new Map<string, { navigation: SlotAttachment; body: SlotAttachment }>();
  const sections = registry(scope.actions.getGroup('settings.pages'));
  const [entryGroup = 'settings.entry', ...entryGroups] = groups;
  const entry = registry(scope.actions.getGroup(entryGroup));
  const plugins = registry(scope.actions.getGroup('settings.plugins'));
  const sync = () => {
    const { translate } = translation;
    const text = (key: string, fallback: string) => translation.text(key, fallback);
    if (closed) return;
    const state = lifecycle.get();
    const activeModules = modules.filter((module) => {
      const phase = state.plugins.find((entry) => entry.id === module.id)?.phase;
      return (
        !['stopping', 'stopped', 'failed', 'blocked'].includes(phase ?? 'idle') &&
        !['stopping', 'stopped', 'failed'].includes(state.phase)
      );
    });
    const catalog = settingsCatalog(activeModules, appId, translate);
    sections.sync(
      visibleSections(catalog).map((section) => ({
        id: `settings.section.${section.id}`,
        title: section.title,
        description: section.description,
        href: sectionHref(basePath, section),
        icon: section.icon as ActionIcon | undefined,
        order: section.order,
        shortcut: section.shortcut ? { keys: section.shortcut } : undefined,
        metadata: destinationMetadata({
          kind: 'settings',
          plugin: section.app ? undefined : section.plugin,
        }),
        groups: [
          new ActionGroup(
            groupId('settings.category', section.category),
            categoryTitle(section.category, translate),
          ),
        ],
      })),
    );
    const ids = new Set(visibleSections(catalog).map((section) => section.id));
    for (const [id, projection] of projections)
      if (!ids.has(id)) {
        projection.navigation.dispose();
        projection.body.dispose();
        projections.delete(id);
      }
    for (const section of visibleSections(catalog))
      if (!projections.has(section.id)) {
        const navigation = scope.slots.attach(
          {
            slot: 'app-preferences.navigation',
            id: `page:${section.id}`,
            actionId: `settings.section.${section.id}`,
            order: section.order,
          },
          { availability: 'wait' },
        );
        const body = scope.slots.attach(
          {
            slot: 'app-preferences.page.body',
            id: `page:${section.id}`,
            key: section.id,
            component: SettingsBody,
          },
          { availability: 'wait' },
        );
        projections.set(section.id, { navigation, body });
      }
    entry.sync([
      {
        id: 'app-preferences.settings',
        title: message(translate, 'settings'),
        href: basePath,
        icon: SettingIcon,
        groups: entryGroups.map((id) => new ActionGroup(id)),
      },
    ]);
    const overview = catalog.find((section) => section.id === pluginId);
    const heading = new ActionGroup('settings.plugins.heading', message(translate, 'plugins'));
    plugins.sync(
      overview
        ? activeModules
            .filter((module) => module.id !== appId)
            .map((plugin) => ({
              id: `settings.plugins.${plugin.id}`,
              title: text(`plugins.${plugin.id}.name`, plugin.metadata?.name ?? plugin.id),
              description:
                text(`plugins.${plugin.id}.description`, plugin.metadata?.description ?? '') ||
                undefined,
              icon: (plugin.metadata?.icon as ActionIcon | undefined) ?? PuzzleIcon,
              href: `${sectionHref(basePath, overview)}?${new URLSearchParams({ plugin: plugin.id })}`,
              metadata: destinationMetadata({ kind: 'plugin', plugin: plugin.id }),
              groups: [heading],
            }))
        : [],
    );
  };
  sync();
  // The optional Shell entry is independent of the catalog's logical groups.
  const targets = slots ?? (scope.slots.has('shell.navigation') ? ['shell.navigation'] : []);
  const placements = targets.map((name) =>
    scope.slots.attach(
      {
        slot: name,
        id: 'settings-entry',
        actionId: 'app-preferences.settings',
      },
      { availability: 'wait' },
    ),
  );
  const unsubscribe = translation.subscribe(sync);
  // Declarations are immutable for this runtime. Re-sync only when available owners change.
  let availability = '';
  const stopWatching = lifecycle.subscribe((state) => {
    const next = JSON.stringify([
      state.phase === 'stopping' || state.phase === 'stopped' || state.phase === 'failed',
      state.plugins
        .filter((entry) => ['stopping', 'stopped', 'failed', 'blocked'].includes(entry.phase))
        .map((entry) => entry.id),
    ]);
    if (next !== availability) {
      availability = next;
      sync();
    }
  });
  const dispose = () => {
    if (closed) return;
    closed = true;
    stopWatching();
    unsubscribe();
    for (const placement of placements) placement.dispose();
    for (const projection of projections.values()) {
      projection.navigation.dispose();
      projection.body.dispose();
    }
    projections.clear();
    sections.dispose();
    entry.dispose();
    plugins.dispose();
  };
  const release = scope.onClose(dispose);
  return () => {
    release();
    dispose();
  };
}
