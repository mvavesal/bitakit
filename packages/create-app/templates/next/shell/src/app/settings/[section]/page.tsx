'use client';
import { usePathname } from 'next/navigation';
import { SettingsPage } from '@bitakit/shell';

export default function Page() {
  return <SettingsPage pathname={usePathname()} unavailable="This setting is unavailable." />;
}
