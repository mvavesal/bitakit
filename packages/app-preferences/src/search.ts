import type { SettingsCatalogField, SettingsCatalogSection } from '@bitakit/ui';

export type SettingsSearchResult = {
  readonly section: SettingsCatalogSection;
  /** All fields when the section itself matches, otherwise the matching ones. */
  readonly fields: readonly SettingsCatalogField[];
};

const words = (query: string) => query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
const contains = (text: string, terms: readonly string[]) => {
  const haystack = text.toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
};

/**
 * Sections whose title or description contains every word of the query, with all their fields,
 * and sections with fields that match together with their section's text.
 */
export function searchSettings(
  sections: readonly SettingsCatalogSection[],
  query: string,
): readonly SettingsSearchResult[] {
  const terms = words(query);
  if (!terms.length) return sections.map((section) => ({ section, fields: section.fields }));
  return sections.flatMap((section) => {
    const own = `${section.title} ${section.description ?? ''}`;
    if (contains(own, terms)) return [{ section, fields: section.fields }];
    const fields = section.fields.filter((field) =>
      contains(
        [
          own,
          field.label,
          field.description ?? '',
          ...(field.options ?? []).map((option) => option.label),
        ].join(' '),
        terms,
      ),
    );
    return fields.length ? [{ section, fields }] : [];
  });
}
