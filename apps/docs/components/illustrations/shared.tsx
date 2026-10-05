'use client';
import type { ReactNode } from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { SourceTree } from './source-tree';

export type Region = {
  key: string;
  label: string;
  explanation: string;
  slot?: string;
  accepts?: string;
};
export const targetStyle = (selected: boolean, slot = false) =>
  `w-full min-w-0 rounded-lg border p-3 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring ${slot ? 'border-dashed' : ''} ${selected ? 'border-fd-primary bg-fd-primary/10 text-fd-foreground' : 'border-fd-border bg-fd-background text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground'}`;

export function Target({
  region,
  selected,
  select,
  children,
  controls,
}: {
  region: Region;
  selected: string;
  select: (key: string) => void;
  children?: ReactNode;
  controls: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected === region.key}
      aria-controls={controls}
      onClick={() => select(region.key)}
      className={targetStyle(selected === region.key, !!region.slot)}
    >
      {children ?? region.label}
    </button>
  );
}

export function Explanation({
  id,
  region,
  file,
  code,
  files,
  onFileSelect,
  sourceReveal,
}: {
  id: string;
  region: Region;
  file: string;
  code: string;
  files?: readonly string[];
  onFileSelect?: (file: string) => void;
  sourceReveal?: number;
}) {
  return (
    <div id={id} className="min-w-0 space-y-3">
      <div aria-live="polite" aria-atomic="true" className="space-y-2">
        <p className="font-medium text-fd-foreground">{region.label}</p>
        <p className="text-sm text-fd-muted-foreground">{region.explanation}</p>
        {region.slot && (
          <p className="break-all text-sm">
            <code>{region.slot}</code>
            <span className="text-fd-muted-foreground"> · {region.accepts}</span>
          </p>
        )}
      </div>
      {files ? (
        <div className="grid min-w-0 overflow-hidden rounded-lg border border-fd-border bg-fd-card md:h-88 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:grid-rows-[minmax(0,1fr)]">
          <div className="min-h-0 min-w-0 border-b border-fd-border p-3 md:border-e md:border-b-0">
            <SourceTree
              key={sourceReveal}
              files={files}
              selected={file}
              onSelect={onFileSelect}
              controls={`${id}-source`}
            />
          </div>
          <div
            id={`${id}-source`}
            className="min-h-0 min-w-0 bg-[var(--docs-code-background)] [&_figure.shiki]:my-0 [&_figure.shiki]:rounded-none [&_figure.shiki]:border-0"
          >
            <DynamicCodeBlock lang="tsx" code={code} codeblock={{
              title: file,
              className: 'flex h-full min-h-0 flex-col',
              viewportProps: { className: 'h-64 min-h-0 max-h-none md:h-auto md:flex-1', 'aria-label': 'Example source code' },
            }} />
          </div>
        </div>
      ) : (
        <DynamicCodeBlock lang="tsx" code={code} codeblock={{ title: file }} />
      )}
    </div>
  );
}

export function Frame({
  label,
  children,
  caption,
}: {
  label: string;
  children: ReactNode;
  caption: string;
}) {
  return (
    <figure
      aria-label={label}
      className="not-prose my-8 min-w-0 space-y-4"
      data-doc-illustration=""
    >
      {children}
      <figcaption className="text-sm text-fd-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

/** Shared window chrome for illustrative app previews; window controls are decorative. */
export function AppPreviewWindow({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div
      id={id}
      className="min-w-0 overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-sm"
    >
      <div className="grid grid-cols-3 items-center gap-3 border-b border-fd-border bg-fd-muted p-3">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="size-2 rounded-full bg-fd-muted-foreground/50" />
          <span className="size-2 rounded-full bg-fd-muted-foreground/50" />
          <span className="size-2 rounded-full bg-fd-muted-foreground/50" />
        </div>
        <span className="text-center text-sm font-medium">Your app</span>
      </div>
      {children}
    </div>
  );
}
