'use client';
import { PluginPage } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Page() {
  return <PluginPage fallback={<PageHeader title="Page not found" />} />;
}
