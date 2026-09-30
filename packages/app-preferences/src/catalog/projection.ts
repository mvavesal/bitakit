import type { SettingsSection } from './section.js';

/** Presentation only. Categories never determine persistence scope or permissions. */
export function projectSettings(sections: readonly SettingsSection[], query = '') {
  const groups = new Map<
    string,
    {
      group: SettingsSection['category'];
      entries: { action: SettingsSection & { href: string }; dividerBefore: boolean }[];
    }
  >();
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  for (const section of sections) {
    if (
      !section.visible ||
      !words.every((word) =>
        `${section.title} ${section.description ?? ''}`.toLocaleLowerCase().includes(word),
      )
    )
      continue;
    const key = section.category?.id ?? '';
    const group = groups.get(key) ?? { group: section.category, entries: [] };
    group.entries.push({
      action: { ...section, href: `/settings/${section.path}` },
      dividerBefore: false,
    });
    groups.set(key, group);
  }
  const order = (entry: { action: SettingsSection }) =>
    entry.action.order ?? Number.POSITIVE_INFINITY;
  for (const group of groups.values()) group.entries.sort((a, b) => order(a) - order(b));
  return [...groups.values()].sort((a, b) => (a.group?.order ?? 0) - (b.group?.order ?? 0));
}
