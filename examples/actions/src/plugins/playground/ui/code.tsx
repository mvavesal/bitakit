'use client';
import { useEffect, useState } from 'react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@bitakit/ui/components';

// Every file of this plugin as text, keyed `./actions/hello.ts`. The `?raw` rule that turns
// these imports into strings is in next.config.ts.
const sources = import.meta.glob<string>(['./**/*.ts', './**/*.tsx'], {
  base: '..',
  query: '?raw',
  import: 'default',
  eager: true,
});

/** One file, highlighted with shiki once it loaded; plain text until then. */
function Source({ file }: { file: string }) {
  const code = sources[`./${file}`] ?? `// ${file} was not found.`;
  const [html, setHtml] = useState<string>();
  useEffect(() => {
    let current = true;
    void import('shiki')
      .then(({ codeToHtml }) =>
        codeToHtml(code, {
          lang: file.endsWith('.tsx') ? 'tsx' : 'ts',
          themes: { light: 'github-light', dark: 'github-dark' },
        }),
      )
      .then((result) => current && setHtml(result));
    return () => {
      current = false;
    };
  }, [code, file]);
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{code}</pre>;
}

/** Opens the given files of this plugin, highlighted, in a drawer on the right. */
export function CodeButton({ title, files }: { title: string; files: readonly string[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Code
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>The files of this example, in src/plugins/playground.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6 text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4">
          {files.map((file) => (
            <section key={file} className="flex flex-col gap-2">
              <h3 className="font-mono text-muted-foreground">{file}</h3>
              <Source file={file} />
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
