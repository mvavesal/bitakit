/**
 * Known settings categories in navigation order. A section names one with
 * `defineSettings(..., { category })`; titles come from `settings.categories.<id>.title`.
 * Categories are presentation only and never grant storage or domain access.
 */
export type SettingsCategory = { readonly id: string; readonly order: number };
export const settingsCategories: readonly SettingsCategory[] = Object.freeze([
  { id: 'general', order: -10 },
  { id: 'appearance', order: -5 },
  { id: 'account', order: 0 },
  { id: 'organization', order: 10 },
  { id: 'plugins', order: 90 },
  { id: 'administration', order: 100 },
]);

export type CategoryGroup<Item> = {
  readonly id: string;
  readonly title: string;
  readonly items: readonly Item[];
};
/**
 * Groups items by category: known categories in their order, unknown ones after them by
 * title. Items keep their given order inside a category.
 */
export function groupByCategory<Item>(
  items: readonly Item[],
  categoryOf: (item: Item) => string,
  titleOf: (id: string) => string,
): readonly CategoryGroup<Item>[] {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const id = categoryOf(item);
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  }
  const rank = (id: string) =>
    settingsCategories.find((category) => category.id === id)?.order ?? Number.POSITIVE_INFINITY;
  return [...groups]
    .map(([id, entries]) => ({ id, title: titleOf(id), items: entries }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.title.localeCompare(b.title));
}
