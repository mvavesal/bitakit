import type { ReactNode } from 'react';
import { AppShell } from '@bitakit/shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
