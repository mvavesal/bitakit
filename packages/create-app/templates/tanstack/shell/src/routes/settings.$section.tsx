import { createFileRoute, useLocation } from '@tanstack/react-router';
import { SettingsPage } from '@bitakit/shell';
export const Route = createFileRoute('/settings/$section')({ component: SettingsSection });
function SettingsSection() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return <SettingsPage pathname={pathname} unavailable="This setting is unavailable." />;
}
