import type { ReactNode } from 'react';
import { Workspace } from '@/components/workspace';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Workspace>{children}</Workspace>;
}
