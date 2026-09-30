import type { Metadata } from 'next';
import { SettingsSection } from '@/components/settings/base/settings-section';

// The registered component owns its reactive document title; suppress the inherited static title.
export const metadata: Metadata = { title: null };

// The root ActionList resolves the section, including trusted contributions registered at runtime.
export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <SettingsSection section={section} />;
}
