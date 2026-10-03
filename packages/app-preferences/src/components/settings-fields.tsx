'use client';
import { Fragment } from 'react';
import { fallbackTitle } from '@bitakit/core';
import {
  useTranslation,
  type SettingsCatalogField,
  type SettingsCatalogSection,
} from '@bitakit/ui';
import { FieldGroup, FieldLegend, FieldSet } from '@bitakit/ui/components';
import { Card, CardContent } from './ui/card.js';
import { SettingField } from './setting-field.js';
import { useMessages } from './use-messages.js';

export type SettingsFieldsProps = {
  /** The section whose fields to render; `fields` takes precedence. */
  section?: SettingsCatalogSection;
  fields?: readonly SettingsCatalogField[];
  /** Setting keys to leave out, for pages that render some fields themselves. */
  exclude?: readonly string[];
};

type FieldGroupEntry = { name?: string; fields: SettingsCatalogField[] };
/** Ungrouped fields first, then each `spec.group` in order of first appearance. */
function byGroup(fields: readonly SettingsCatalogField[]): FieldGroupEntry[] {
  const groups = new Map<string | undefined, FieldGroupEntry>();
  const ungrouped: FieldGroupEntry = { fields: [] };
  for (const field of fields) {
    const name = field.spec.group;
    if (!name) {
      ungrouped.fields.push(field);
      continue;
    }
    const group = groups.get(name);
    if (group) group.fields.push(field);
    else groups.set(name, { name, fields: [field] });
  }
  return [ungrouped, ...groups.values()].filter((group) => group.fields.length);
}

/**
 * Generated settings fields in cards: one card without groups, otherwise one per `spec.group`
 * titled by `<plugin>.settings.groups.<group>` (the app uses `app`), then the group name.
 */
export function SettingsFields({ section, fields, exclude = [] }: SettingsFieldsProps) {
  const messages = useMessages();
  const t = useTranslation();
  const visible = (fields ?? section?.fields ?? []).filter((field) => !exclude.includes(field.key));
  if (!visible.length)
    return <p className="text-sm text-muted-foreground">{messages('noFields')}</p>;
  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {byGroup(visible).map((group) => {
        const card = (
          <Card>
            <CardContent>
              <FieldGroup>
                {group.fields.map((field) => (
                  <SettingField key={field.key} field={field} />
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
        );
        if (!group.name) return <Fragment key="">{card}</Fragment>;
        const [first] = group.fields;
        const prefix = first && first.key === first.name ? 'app' : first?.plugin;
        return (
          <FieldSet key={group.name} className="min-w-0">
            <FieldLegend variant="label">
              {t(
                `${prefix}.settings.groups.${group.name}`,
                undefined,
                fallbackTitle({ id: group.name }),
              )}
            </FieldLegend>
            {card}
          </FieldSet>
        );
      })}
    </div>
  );
}
