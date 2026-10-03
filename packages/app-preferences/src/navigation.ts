import {
  ActionGroup,
  destinationMetadata,
  type ActionDefinition,
  type ActionIcon,
  type PluginScope,
  type ScopeTranslation,
} from '@bitakit/core';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import SettingIcon from 'reicon-react/icons/Setting';
import { settingsCatalog, visibleSections, type SettingsCatalogModule } from './catalog.js';
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
};
type Target = ReturnType<PluginScope['actions']['getGroup']>;
type Registration = { handle: ReturnType<Target['add']>; groups: string };

const groupKey = (groups: readonly ActionGroup[] = []) =>
  groups.map((group) => `${group.id}\u0000${group.title ?? ''}`).join('\u0001');
/** `defineSettings(..., { shortcut })` opens the page from the keyboard. */
const shortcutOf = (modules: readonly SettingsCatalogModule[], id: string) => {
  const keys = modules.find((module) => module.id === id)?.settings?.section?.shortcut;
  return keys ? { keys } : undefined;
};
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
  { modules, appId, translation, basePath, groups }: SettingsNavigationProjection,
): () => void {
  const sections = registry(scope.actions.getGroup('settings.pages'));
  const [entryGroup = 'settings.entry', ...entryGroups] = groups;
  const entry = registry(scope.actions.getGroup(entryGroup));
  const plugins = registry(scope.actions.getGroup('settings.plugins'));
  const sync = () => {
    const { translate } = translation;
    const text = (key: string, fallback: string) => translation.text(key, fallback);
    const catalog = settingsCatalog(modules, appId, translate);
    sections.sync(
      visibleSections(catalog).map((section) => ({
        id: `settings.section.${section.id}`,
        title: section.title,
        description: section.description,
        href: sectionHref(basePath, section),
        icon: section.icon as ActionIcon | undefined,
        order: section.order,
        shortcut: shortcutOf(modules, section.id),
        metadata: destinationMetadata({
          kind: 'settings',
          plugin: section.app ? undefined : section.id,
        }),
        groups: [
          new ActionGroup(
            groupId('settings.category', section.category),
            categoryTitle(section.category, translate),
          ),
        ],
      })),
    );
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
        ? modules
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
  const unsubscribe = translation.subscribe(sync);
  return () => {
    unsubscribe();
    sections.dispose();
    entry.dispose();
    plugins.dispose();
  };
}
