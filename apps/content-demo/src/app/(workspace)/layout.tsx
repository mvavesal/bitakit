import type { ReactNode } from 'react';
import { WorkspaceLayout } from '@/components/workspace-layout';
export default function Layout({ children }: { children: ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
