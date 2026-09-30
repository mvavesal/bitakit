import type { ReactNode } from 'react';
import { SettingsDialog } from '@/components/settings/base/settings-dialog';
export default function SettingsDialogLayout({ children }: { children: ReactNode }) {
  return <SettingsDialog>{children}</SettingsDialog>;
}
