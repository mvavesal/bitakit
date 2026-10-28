'use client';
import { Action, PluginSlot, useSlot } from '@bitakit/ui';
import { Button, PageHeader } from '@bitakit/ui/components';

// Served at /dashboard. The page owns the layout; every card and button comes from another
// plugin through the dashboard.widgets and dashboard.toolbar slots.
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle="Each card is a plugin reading the shop's SQLite data."
        trailing={<Toolbar />}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PluginSlot name="dashboard.widgets" />
      </div>
    </div>
  );
}

/** The Actions other plugins placed in dashboard.toolbar, as buttons. */
function Toolbar() {
  const toolbar = useSlot('dashboard.toolbar');
  if (toolbar.error) throw toolbar.error;
  return (
    <div className="flex flex-wrap gap-2">
      {toolbar.items.map((item) => (
        <Action key={item.key} id={item.action}>
          <Button variant="outline" />
        </Action>
      ))}
    </div>
  );
}
