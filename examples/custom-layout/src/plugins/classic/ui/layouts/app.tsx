'use client';
import type { ReactNode } from 'react';
import { AppShell } from '@bitakit/shell';

/**
 * A second candidate for `layout.app`, offered by this plugin: Shell's sidebar frame, composed
 * from its parts (the sidebar shows the shell.brand slot itself). The app's own
 * src/layouts/app.tsx wins until bitakit.config.ts chooses this one: `'layout.app': 'classic'`.
 */
export default function ClassicFrame({ children }: { children?: ReactNode }) {
  return (
    <>
      <AppShell.Sidebar
        footer={<p className="text-sm text-muted-foreground">Frame: the classic plugin</p>}
      />
      <AppShell.Content topBar={<AppShell.TopBar />}>{children}</AppShell.Content>
    </>
  );
}
