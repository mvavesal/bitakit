'use client';
import { useCallback, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import type { Setting } from '../fields/setting.js';
import type { SettingsSection } from '../catalog/section.js';
import type {
  SettingsSectionItem,
  SettingsSectionRendererProps,
  SettingsViewProps,
} from '../renderers/types.js';
import { ConfigurationAlert, useSettingsItems } from '../react/items.js';
import { useSettingsSections } from '../react/provider.js';
import { useSettingsText, useSettingsUI } from '../react/ui-context.js';

import { Card, CardContent } from './ui/card.js';
import { FieldGroup, FieldSet, FieldLegend } from './ui/field.js';
import { Button } from './ui/button.js';

const visible = (item: SettingsSectionItem) => item.state?.visible ?? item.setting.visible;
/** One field with the resolved renderer and the default (or app-replaced) field layout. */
export function SettingsField({
  setting,
  disabled,
}: {
  setting: Setting<any>;
  disabled?: boolean;
}) {
  const fields = useMemo(() => [setting], [setting]);
  const [item] = useSettingsItems(fields, { disabled });
  return item && visible(item) ? <>{item.content}</> : null;
}
function FieldsCard({ items }: { items: readonly SettingsSectionItem[] }) {
  return (
    <Card>
      <CardContent>
        <FieldGroup>
          {items.map((item) => (
            <div key={item.key}>{item.content}</div>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
/** Default section body: referenced fields in one card, legacy groups under their titles. */
export function DefaultSectionView({ items, section, content }: SettingsSectionRendererProps) {
  return <>{content ?? <SectionBody section={section} items={items} />}</>;
}
function SectionBody({
  section,
  items,
}: {
  section: SettingsSection;
  items: readonly SettingsSectionItem[];
}) {
  const { messages } = useSettingsUI();
  const byKey = new Map(items.map((item) => [item.key, item]));
  const fields = section.fields.flatMap((field) => byKey.get(field.key) ?? []);
  const groups = section.groups
    .map((group) => ({
      title: group.title,
      items: group.items.flatMap((field) => byKey.get(field.key) ?? []),
    }))
    .filter((group) => group.items.length);
  if (!fields.length && !groups.length)
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  return (
    <div className="grid gap-6">
      {fields.length > 0 && <FieldsCard items={fields} />}
      {groups.map((group, index) => (
        <FieldSet key={index}>
          <FieldLegend variant="label">{group.title}</FieldLegend>
          <FieldsCard items={group.items} />
        </FieldSet>
      ))}
    </div>
  );
}
/**
 * Renders a section: its section renderer, a legacy component, the app's section view or the
 * default layout. Values, subscriptions and persistence stay in AppPreferences.
 */
export function SettingsSectionView({
  section,
  header = false,
}: {
  section: SettingsSection;
  /** Render the section title and description above the content. */
  header?: boolean;
}) {
  const ui = useSettingsUI();
  const text = useSettingsText();
  const fields = useMemo(
    () => [...new Set([...section.fields, ...section.groups.flatMap((group) => group.items)])],
    [section],
  );
  const items = useSettingsItems(fields, { disabled: !section.enabled }).filter(visible);
  if (!section.visible) return null;
  const title = text.sectionTitle(section);
  const description = text.sectionDescription(section);
  let body: ReactNode;
  try {
    const Custom = ui.renderers.resolveSection(section);
    const props: SettingsSectionRendererProps = {
      section,
      title,
      description,
      items,
      content: <SectionBody section={section} items={items} />,
      disabled: !section.enabled,
    };
    if (Custom) body = <Custom {...props} />;
    else if (section.component) body = <section.component />;
    else {
      const View = ui.renderers.resolveView('section') ?? DefaultSectionView;
      body = <View {...props} />;
    }
  } catch (error) {
    body = (
      <ConfigurationAlert messages={ui.messages}>
        {error instanceof Error ? error.message : String(error)}
      </ConfigurationAlert>
    );
  }
  return (
    <div data-slot="settings-section" className="grid gap-4">
      {header && (
        <header className="grid gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </header>
      )}
      {body}
    </div>
  );
}
function DefaultSettingsView({
  sections,
  selected,
  select,
  renderSection,
  text,
}: SettingsViewProps) {
  const { messages } = useSettingsUI();
  return (
    <div data-slot="settings-view" className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label={messages.navigation}>
        <ul className="grid gap-1">
          {sections.map((section) => (
            <li key={section.id}>
              <Button
                type="button"
                aria-current={section === selected ? 'true' : undefined}
                disabled={!section.enabled}
                onClick={() => select(section.id)}
                variant={section === selected ? 'secondary' : 'ghost'}
                className="w-full justify-start"
              >
                {section.icon && <section.icon className="size-4 shrink-0" aria-hidden="true" />}
                <span className="truncate">{text(section, 'title')}</span>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">
        {selected ? (
          renderSection(selected)
        ) : (
          <p className="text-sm text-muted-foreground">{messages.empty}</p>
        )}
      </div>
    </div>
  );
}
/** The complete settings view: navigation and content share one selection state. */
export function SettingsView({
  section: controlled,
  defaultSection,
  onSectionChange,
}: {
  section?: string;
  defaultSection?: string;
  onSectionChange?: (id: string) => void;
}) {
  const ui = useSettingsUI();
  const texts = useSettingsText();
  const all = useSettingsSections();
  const sections = useMemo(
    () =>
      all.filter(
        (section) =>
          section.visible && (section.fields.length || section.groups.length || section.component),
      ),
    [all],
  );
  const [internal, setInternal] = useState(defaultSection);
  const selected =
    sections.find((section) => section.id === (controlled ?? internal)) ?? sections[0];
  const select = useCallback(
    (id: string) => {
      if (controlled === undefined) setInternal(id);
      onSectionChange?.(id);
    },
    [controlled, onSectionChange],
  );
  const renderSection = useCallback(
    (section: SettingsSection) => <SettingsSectionView key={section.id} section={section} header />,
    [],
  );
  const text = useCallback(
    (section: SettingsSection, part: 'title' | 'description') =>
      part === 'title' ? texts.sectionTitle(section) : texts.sectionDescription(section),
    [texts],
  );
  let View: ComponentType<SettingsViewProps> = DefaultSettingsView;
  try {
    View = ui.renderers.resolveView('settings') ?? DefaultSettingsView;
  } catch {
    View = DefaultSettingsView;
  }
  return (
    <View
      sections={sections}
      selected={selected}
      select={select}
      renderSection={renderSection}
      text={text}
    />
  );
}
