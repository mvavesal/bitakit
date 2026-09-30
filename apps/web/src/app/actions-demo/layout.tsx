import type { ReactNode } from 'react';
export default function DemoLayout({
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
