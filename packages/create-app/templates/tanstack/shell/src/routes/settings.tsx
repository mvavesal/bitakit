import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { FoundationLink } from '@bitakit/tanstack';
import { SettingsShell } from '@bitakit/shell';
export const Route = createFileRoute('/settings')({ component: SettingsLayout });
function SettingsLayout() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <SettingsShell pathname={pathname} linkComponent={FoundationLink} backHref="/">
      <Outlet />
    </SettingsShell>
  );
}
