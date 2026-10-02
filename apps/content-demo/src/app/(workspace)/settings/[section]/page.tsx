'use client';
import { SettingsPage } from '@bitakit/shell';
import { usePathname } from 'next/navigation';
export default function Page() {
  const pathname = usePathname();
  return (
    <SettingsPage
      pathname={
        pathname === '/settings/organization-invitations'
          ? '/settings/organization-members'
          : pathname
      }
      unavailable="Diese Einstellung ist nicht verfügbar."
    />
  );
}
