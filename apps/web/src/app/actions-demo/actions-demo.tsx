'use client';

import { PageHeader } from '@/components/layout/page-header';
import { useMemo, useState } from 'react';
import { useAction, useActionList } from '@bitakit/ui/actions';
import { SAVE, PREVIEW } from '@/actions/examples/demo/definitions';
import { demoActions } from '@/actions/examples/demo/definitions';
import { useRegisterActions } from '@bitakit/ui/actions';
import CheckIcon from 'reicon-react/icons/Check';
import SaveIcon from 'reicon-react/icons/Floppy';
import SendIcon from 'reicon-react/icons/Send';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@bitakit/ui/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PlacementExample } from '@/app/actions-demo/placement-example';
import { ControlPreview } from '@/app/actions-demo/control-preview';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function DemoContent() {
  const list = useActionList();
  const save = useAction(SAVE);
  const preview = useAction(PREVIEW);
  const [completed, setCompleted] = useState(0);
  const [message, setMessage] = useState('Ready. Try either save control.');
  const [error, setError] = useState('');
  const [handlerLabel, setHandlerLabel] = useState('Save');

  const definitions = useMemo(
    () => demoActions({ list, setError, setMessage, setCompleted }),
    [list],
  );
  useRegisterActions(definitions);
  const definition = definitions[0];

  const onError = (cause: unknown) => {
    setError(cause instanceof Error ? cause.message : 'The action failed.');
    setMessage('The action finished with an error. Both controls are ready again.');
  };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="One action. Every control."
        subtitle="Change an action once and see both places respond. This demo runs entirely in your browser."
        trailing={<Badge variant="secondary">SaaS Foundation · Public demo</Badge>}
      />

      <ControlPreview />

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>The same actions also appear in the draft card below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Quick actions">
            <ActionButton as={Button} action={SAVE} onError={onError} variant="outline" />
            <ActionButton as={Button} action={PREVIEW} onError={onError} variant="outline" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Central action settings</h2>
            </CardTitle>
            <CardDescription>These controls update one shared definition.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="action-title">Save action label</FieldLabel>
                <Input
                  id="action-title"
                  value={save?.title ?? ''}
                  disabled={!save}
                  onChange={(event) => list.update(SAVE, { title: event.target.value })}
                />
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                aria-pressed={save?.enabled ?? false}
                onClick={() => list.update(SAVE, { enabled: !list.get(SAVE)?.enabled })}
              >
                {save?.enabled ? 'Disable save' : 'Enable save'}
              </Button>
              <Button
                variant="outline"
                aria-pressed={save?.visible ?? false}
                onClick={() => list.update(SAVE, { visible: !list.get(SAVE)?.visible })}
              >
                {save?.visible ? 'Hide save' : 'Show save'}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  list.update(SAVE, {
                    icon: list.get(SAVE)?.icon === SaveIcon ? SendIcon : SaveIcon,
                  })
                }
              >
                Switch icon
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Current handler: {handlerLabel}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    list.update(SAVE, {
                      execute: async () => {
                        setError('');
                        setMessage('Running alternate handler…');
                        await new Promise((resolve) => setTimeout(resolve, 900));
                        setCompleted((value) => value + 1);
                        setMessage('Alternate handler completed.');
                      },
                    });
                    setHandlerLabel('Alternate');
                  }}
                >
                  Use alternate handler
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    list.update(SAVE, {
                      execute: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 900));
                        throw new Error(
                          'Example failure. The caller can decide how to display it.',
                        );
                      },
                    });
                    setHandlerLabel('Failure example');
                  }}
                >
                  Use failing handler
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    list.update(SAVE, { execute: definition.execute });
                    setHandlerLabel('Save');
                    setError('');
                  }}
                >
                  Restore save handler
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Your draft</h2>
            </CardTitle>
            <CardDescription>A second place to use the same actions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p>Introduction to your next project</p>
            <Badge variant="outline">{preview?.checked ? 'Preview is on' : 'Preview is off'}</Badge>
            <div className="flex flex-wrap gap-3" role="group" aria-label="Draft actions">
              <ActionButton as={Button} action={SAVE} onError={onError} />
              <ActionButton as={Button} action={PREVIEW} onError={onError} variant="outline" />
            </div>
            <p className="text-sm text-muted-foreground">
              While an action runs, both of its controls share the same busy state.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Activity</h2>
          </CardTitle>
          <CardDescription>
            Successful runs: <span data-testid="completed-count">{completed}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p role="status" className="flex items-center gap-2">
            <CheckIcon className="size-4" aria-hidden="true" />
            {message}
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <PlacementExample />
    </main>
  );
}

export function ActionsDemo() {
  return <DemoContent />;
}
