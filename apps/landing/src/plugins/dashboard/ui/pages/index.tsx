'use client';
import { Action, PluginSlot, useSlot, useTranslation } from '@bitakit/ui';
import { Button, PageHeader } from '@bitakit/ui/components';

/** The dashboard owns only its frame: the widgets and toolbar Actions come from other plugins. */
export default function Dashboard() {
  const t = useTranslation();
  const toolbar = useSlot('dashboard.toolbar');
  return (
    <>
      <PageHeader
        title={t('dashboard.page.title', undefined, 'Dashboard')}
        subtitle={t('dashboard.page.subtitle', undefined, 'Every widget below is a plugin.')}
        trailing={toolbar.items.map((item) => (
          <Action key={item.key} id={item.action}>
            <Button size="sm" variant={item.action.variant ?? 'outline'} />
          </Action>
        ))}
      />
      <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_14rem]">
        <PluginSlot name="dashboard.stats" />
      </div>
      <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_16rem]">
        <PluginSlot
          name="dashboard.widgets"
          fallback={
            <p className="text-sm text-muted-foreground">
              {t('dashboard.page.empty', undefined, 'No widgets: every widget plugin is off.')}
            </p>
          }
        />
      </div>
    </>
  );
}
