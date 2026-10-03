'use client';
import { SettingsPage } from '@bitakit/app-preferences';
import { usePathname } from 'next/navigation';
export default function Page() {
  const pathname = usePathname();
  return (
    <SettingsPage
      pathname={pathname}
      unavailable="Diese Einstellung ist nicht verfügbar."
    />
  );
}
