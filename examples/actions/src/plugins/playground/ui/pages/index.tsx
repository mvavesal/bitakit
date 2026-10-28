'use client';
import type { ComponentType } from 'react';
import BookIcon from 'reicon-react/icons/BookOpen';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  buttonVariants,
} from '@bitakit/ui/components';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SourceCode } from '../code';
import { docs } from '../docs';
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
  /** The Action files, shown first by "Show source code" (relative to the plugin folder). */
  action: readonly string[];
  /** The rest of the example: its UI and helpers, under "Full sample". */
  files: readonly string[];
  /** The documentation of what the example shows. */
  docs: string;
  Body: ComponentType;
};

const examples: readonly Example[] = [
  {
    id: 'live',
    title: 'Live action',
    about:
      'Add Actions while the app runs and give each its own places, look and behaviour. Every change shows at once.',
    action: ['live-action.ts'],
    files: [
      'ui/providers/live.tsx',
      'services/live.ts',
      'actions/live/add.ts',
      'actions/live/edit.ts',
      'actions/live/remove.ts',
      'ui/examples/live.tsx',
    ],
    docs: `${docs.actions}#properties-at-a-glance`,
    Body: LiveExample,
  },
  {
    id: 'messages',
    title: 'Messages',
    about: 'A run ends with a message: `success` words it, a throw becomes `failure`.',
    action: ['actions/hello.ts', 'actions/fail.ts'],
    files: ['ui/examples/messages.tsx'],
    docs: `${docs.actions}#success-and-failure`,
    Body: MessagesExample,
  },
  {
    id: 'input',
    title: 'Input',
    about: 'A schema types and checks the input; the button waits for a valid name.',
    action: ['actions/greet.ts'],
    files: ['ui/examples/input.tsx'],
    docs: `${docs.actions}#input`,
    Body: InputExample,
  },
  {
    id: 'running',
    title: 'While it runs',
    about: 'Pending states and what happens to a second run: `concurrency`.',
    action: ['actions/slow.ts', 'actions/like.ts', 'actions/search.ts'],
    files: ['actions/-wait.ts', 'ui/examples/running.tsx'],
    docs: `${docs.actions}#concurrency`,
    Body: RunningExample,
  },
  {
    id: 'confirm',
    title: 'Confirm and dialog',
    about: 'Ask before a run, or open a component instead of running.',
    action: ['actions/reset.ts', 'actions/details.ts'],
    files: ['ui/dialogs/details.tsx', 'ui/examples/confirm.tsx'],
    docs: `${docs.actions}#confirm`,
    Body: ConfirmExample,
  },
  {
    id: 'more',
    title: 'Shortcut, link, menu',
    about: 'The same Action from the keyboard, as a link, or listed in a menu.',
    action: ['actions/shortcut.ts', 'actions/docs.ts', 'actions/copy.ts', 'actions/print.ts'],
    files: ['ui/examples/more.tsx'],
    docs: `${docs.actions}#shortcut`,
    Body: MoreExample,
  },
];

// Served at /playground: one tab per example. Every control in them is an <Action> around a
// plain component; "Show source code" opens the files that make the example.
export default function PlaygroundPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actions playground"
        subtitle="Six examples of defineAction. Each one can show its source code."
      />
      <Tabs defaultValue="live">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {examples.map((example, index) => (
            <TabsTrigger key={example.id} value={example.id} className="flex-none">
              {index + 1} · {example.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {examples.map(({ id, title, about, action, files, docs: link, Body }, index) => (
          <TabsContent key={id} value={id}>
            <Card>
              <CardHeader>
                <CardTitle>
                  Example {index + 1}: {title}
                </CardTitle>
                <CardDescription>{about}</CardDescription>
                <CardAction className="flex flex-wrap justify-end gap-2">
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    <BookIcon data-icon="inline-start" aria-hidden="true" />
                    Read the docs
                  </a>
                  <SourceCode
                    title={`Example ${index + 1}: ${title}`}
                    action={action}
                    files={files}
                  />
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
