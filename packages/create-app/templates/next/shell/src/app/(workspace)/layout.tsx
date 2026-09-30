import type { ReactNode } from 'react';
import { AppShell } from '@bitakit/shell';

export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
