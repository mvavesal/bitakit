'use client';
import type { ComponentType } from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@bitakit/ui/components';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeButton } from '../code';
import { ConfirmExample } from '../examples/confirm';
import { InputExample } from '../examples/input';
import { LiveExample } from '../examples/live';
import { MessagesExample } from '../examples/messages';
import { MoreExample } from '../examples/more';
import { RunningExample } from '../examples/running';

type Example = {
  id: string;
  title: string;
  about: string;
  /** Shown by the Code button, relative to src/plugins/playground. */
  files: readonly string[];
  Body: ComponentType;
};

const examples: readonly Example[] = [
  {
    id: 'live',
    title: 'Live action',
    about: 'Add Actions, place them around the app and change them: every place follows at once.',
    files: [
      'actions/-live.ts',
      'actions/live/first.ts',
      'services/live.ts',
      'actions/live/places.ts',
      'actions/live/title.ts',
      'actions/live/enable.ts',
      'ui/examples/live.tsx',
      'ui/live-actions.tsx',
      'ui/slots/sidebar.footer.tsx',
    ],
    Body: LiveExample,
  },
  {
    id: 'messages',
    title: 'Messages',
    about: 'A run ends with a message: `success` words it, a throw becomes `failure`.',
    files: ['actions/hello.ts', 'actions/fail.ts', 'ui/examples/messages.tsx'],
    Body: MessagesExample,
  },
  {
    id: 'input',
    title: 'Input',
    about: 'A schema types and checks the input; the button waits for a valid name.',
    files: ['actions/greet.ts', 'ui/examples/input.tsx'],
    Body: InputExample,
  },
  {
    id: 'running',
    title: 'While it runs',
    about: 'Pending states and what happens to a second run: `concurrency`.',
    files: [
      'actions/slow.ts',
      'actions/like.ts',
      'actions/search.ts',
      'actions/-wait.ts',
      'ui/examples/running.tsx',
    ],
    Body: RunningExample,
  },
  {
    id: 'confirm',
    title: 'Confirm and dialog',
    about: 'Ask before a run, or open a component instead of running.',
    files: [
      'actions/reset.ts',
      'actions/details.ts',
      'ui/dialogs/details.tsx',
      'ui/examples/confirm.tsx',
    ],
    Body: ConfirmExample,
  },
  {
    id: 'more',
    title: 'Shortcut, link, menu',
    about: 'The same Action from the keyboard, as a link, or listed in a menu.',
    files: [
      'actions/shortcut.ts',
      'actions/docs.ts',
      'actions/copy.ts',
      'actions/print.ts',
      'ui/examples/more.tsx',
    ],
    Body: MoreExample,
  },
];

// Served at /playground: one tab per example. Every button in them is an <Action> around a
// plain component; the Code button shows the files that make the example.
export default function PlaygroundPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actions playground"
        subtitle="Six examples of defineAction. Each tab has a Code button with its files."
      />
      <Tabs defaultValue="live">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {examples.map((example, index) => (
            <TabsTrigger key={example.id} value={example.id} className="flex-none">
              {index + 1} · {example.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {examples.map(({ id, title, about, files, Body }, index) => (
          <TabsContent key={id} value={id}>
            <Card>
              <CardHeader>
                <CardTitle>
                  Example {index + 1}: {title}
                </CardTitle>
                <CardDescription>{about}</CardDescription>
                <CardAction>
                  <CodeButton title={`Example ${index + 1}: ${title}`} files={files} />
                </CardAction>
              </CardHeader>
              <CardContent>
                <Body />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
