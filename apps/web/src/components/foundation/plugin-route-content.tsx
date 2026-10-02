'use client';
import { usePathname } from 'next/navigation';
import { PluginPage } from '@bitakit/ui';
export function PluginRouteContent() {
  return <PluginPage pathname={usePathname()} fallback={<p>Diese Seite ist nicht verfügbar.</p>} />;
}
