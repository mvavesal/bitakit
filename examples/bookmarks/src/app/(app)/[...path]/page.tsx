'use client';
import { PluginPage } from '@bitakit/ui';
import { NotFoundPage } from '@bitakit/shell/pages';

export default function Page() {
  return <PluginPage fallback={<NotFoundPage />} />;
}
