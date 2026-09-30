import type { ReactNode } from 'react';

export default function WorkspaceLayout({
  children,
  settings,
}: {
  children: ReactNode;
  settings: ReactNode;
}) {
  return (
    <>
      {children}
      {settings}
    </>
  );
}
