'use client';
import { useEffect, useState } from 'react';
import CodeIcon from 'reicon-react/icons/Code';
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@bitakit/ui/components';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

function Files({ files }: { files: readonly string[] }) {
  return (
    <div className="flex flex-col gap-6 text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4">
      {files.map((file) => (
        <section key={file} className="flex flex-col gap-2">
          <h3 className="font-mono text-muted-foreground">{file}</h3>
          <Source file={file} />
        </section>
      ))}
    </div>
  );
}

/**
 * "Show source code": a drawer on the right with the example's files, highlighted. The Action
 * tab (the default) shows the Action files; Full sample adds the UI and helpers.
 */
export function SourceCode(props: {
  title: string;
  action: readonly string[];
  files: readonly string[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <CodeIcon data-icon="inline-start" aria-hidden="true" />
          Show source code
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        <SheetHeader>
          <SheetTitle>{props.title}</SheetTitle>
          <SheetDescription>Files in src/plugins/playground.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="action" className="min-h-0 flex-1 px-4 pb-6">
          <TabsList>
            <TabsTrigger value="action">Action source code</TabsTrigger>
            <TabsTrigger value="full">Full sample</TabsTrigger>
          </TabsList>
          <TabsContent value="action" className="overflow-y-auto">
            <Files files={props.action} />
          </TabsContent>
          <TabsContent value="full" className="overflow-y-auto">
            <Files files={[...props.action, ...props.files]} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
