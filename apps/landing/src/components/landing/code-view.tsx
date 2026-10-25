'use client';
import { useState } from 'react';
import { Button } from '@bitakit/ui/components';
import type { PluginCode } from './code-files';

/** The files of one playground plugin, exactly as they run in the app. Fills its container. */
export function CodeView({ code, plugin }: { code: PluginCode[]; plugin: string }) {
  const current = code.find((entry) => entry.id === plugin) ?? code[0];
  const [selected, setSelected] = useState<string | null>(null);
  const file = current.files.find((entry) => entry.path === selected) ?? current.files[0];
  const lines = current.files.reduce((sum, entry) => sum + entry.lines, 0);
  return (
    <div className="flex h-full flex-col">
      <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Files"
          className="flex flex-col gap-0.5 overflow-y-auto border-b p-3 md:border-r md:border-b-0"
        >
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            <code>src/plugins/{current.id}/</code>
            <br />
            {current.files.length} files, {lines} lines
          </p>
          {current.files.map((entry) => (
            <Button
              key={entry.path}
              size="sm"
              variant={entry.path === file.path ? 'secondary' : 'ghost'}
              aria-current={entry.path === file.path ? 'true' : undefined}
              className="justify-start font-mono text-xs"
              onClick={() => setSelected(entry.path)}
            >
              {entry.path}
            </Button>
          ))}
        </nav>
        <div
          className="code-view min-h-0 overflow-auto p-5 text-[13px] leading-relaxed"
          // Highlighted by Shiki on the server from this repository's own files.
          dangerouslySetInnerHTML={{ __html: file.html }}
        />
      </div>
    </div>
  );
}
