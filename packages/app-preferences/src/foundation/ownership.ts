import { SettingsSection } from '../catalog/section.js';
/** Contributed sections belong to their contributing module unless they already name it. */
export function ownedSection(section: SettingsSection, module: string, origin: string) {
  if (section.pluginId && section.pluginId !== module)
    throw new Error(
      `Settings section "${section.id}" in ${origin} declares pluginId "${section.pluginId}" but is contributed by "${module}".`,
    );
  return section.pluginId ? section : new SettingsSection({ ...section, pluginId: module });
}
