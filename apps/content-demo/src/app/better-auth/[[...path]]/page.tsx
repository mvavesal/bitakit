'use client';
import { PluginPage } from '@bitakit/ui';
import { usePathname } from 'next/navigation';
export default function Page() {
  return (
    <PluginPage pathname={usePathname()} fallback={<p>Diese Auth-Seite ist nicht verfügbar.</p>} />
  );
}
