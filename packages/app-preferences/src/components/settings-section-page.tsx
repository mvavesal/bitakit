'use client';
import { Fragment } from 'react';
import { Action, PluginSlot, useSlot, type SettingsCatalogSection } from '@bitakit/ui';
import { Button, PageHeader } from '@bitakit/ui/components';

export type SettingsSectionPageProps = {
  section: SettingsCatalogSection;
  /** Render the section title and description as the page header. Default: true. */
  showHeader?: boolean;
};

/** Runs inside the page owner's boundary, including all extension widgets and Actions. */
function Content({ section, showHeader }: SettingsSectionPageProps) {
  const payload = { pageId: section.id };
  const toolbar = useSlot('app-preferences.page.toolbar', { payload });
  if (toolbar.error) throw toolbar.error;
  return (
    <div
      data-settings-section={section.id}
      className={`flex w-full min-w-0 flex-1 flex-col gap-6 ${showHeader ? 'min-h-fit' : 'min-h-0'}`}
    >
      {showHeader && <PageHeader title={section.title} subtitle={section.description} />}
      <PluginSlot name="app-preferences.page.header" payload={payload} />
      {!!toolbar.items.length && (
        <div className="flex flex-wrap items-center gap-2">
          {toolbar.items.map((item) =>
            item.action.href ? (
              <Button key={item.key} asChild>
                <Action id={item.action} kind="link">
                  <a />
                </Action>
              </Button>
            ) : (
              <Action key={item.key} id={item.action}>
                <Button />
              </Action>
            ),
          )}
        </div>
      )}
      <PluginSlot name="app-preferences.page.before" payload={payload} />
      <PluginSlot name="app-preferences.page.body" entryKey={section.id} payload={payload} />
      <PluginSlot name="app-preferences.page.after" payload={payload} />
      <PluginSlot name="app-preferences.page.footer" payload={payload} />
    </div>
  );
}

/** The existing page frame encloses its body and extensions in the same access boundary. */
export function SettingsSectionPage({
  section,
  showHeader = section.showHeader ?? true,
}: SettingsSectionPageProps) {
  const Boundary = section.boundary ?? Fragment;
  return (
    <Boundary>
      <Content section={section} showHeader={showHeader} />
    </Boundary>
  );
}
