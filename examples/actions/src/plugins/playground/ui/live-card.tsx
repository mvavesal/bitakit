'use client';
import { useState } from 'react';
import { Action, useServiceState, useSlot } from '@bitakit/ui';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
  Input,
  RadioGroup,
  RadioGroupItem,
} from '@bitakit/ui/components';
import { icons } from '../services/live';
import { glyphs } from './live-icon';

/**
 * The live Action and its controls. Every control below is an <Action> around a plain
 * component; none of them knows where the live Action is shown.
 */
export function LiveCard() {
  const [title, setTitle] = useState('');
  const [tooltip, setTooltip] = useState('');
  const current = useServiceState('playground.live', (state) => state, undefined);
  const samples = useSlot('playground.samples');
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>One Action, every place</CardTitle>
        <CardDescription>
          The live Action sits in the sidebar, in the app bar, in the More menu and here. Change it
          below: each control is an Action that changes one field, and every place follows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <Action id="playground.live.target">
              <Button size="lg" />
            </Action>
            <FieldDescription>
              {current?.visible
                ? `Clicked ${current.clicks} ${current.clicks === 1 ? 'time' : 'times'}`
                : 'Hidden everywhere. Tick Visible to bring it back.'}
            </FieldDescription>
          </Field>
          <form className="flex items-end gap-2" onSubmit={(event) => event.preventDefault()}>
            <Field>
              <FieldLabel htmlFor="live-title">Title</FieldLabel>
              <Input
                id="live-title"
                value={title}
                placeholder={current?.title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Action
              id="playground.live.rename"
              input={title}
              onExecuted={(result) => result.status === 'completed' && setTitle('')}
            >
              <Button type="submit" variant="outline" />
            </Action>
          </form>
          <form className="flex items-end gap-2" onSubmit={(event) => event.preventDefault()}>
            <Field>
              <FieldLabel htmlFor="live-tooltip">Tooltip</FieldLabel>
              <Input
                id="live-tooltip"
                value={tooltip}
                placeholder="Empty removes it"
                onChange={(event) => setTooltip(event.target.value)}
              />
            </Field>
            <Action
              id="playground.live.tooltip"
              input={tooltip}
              onExecuted={(result) => result.status === 'completed' && setTooltip('')}
            >
              <Button type="submit" variant="outline" />
            </Action>
          </form>
          <FieldSet>
            <FieldLegend variant="label">Icon</FieldLegend>
            <Action id="playground.live.icon" kind="choice">
              <RadioGroup aria-label="Icon" className="flex flex-wrap gap-4">
                {icons.map((icon) => {
                  const Glyph = glyphs[icon];
                  return (
                    <Field key={icon} orientation="horizontal" className="w-auto">
                      <RadioGroupItem value={icon} id={`live-icon-${icon}`} />
                      <FieldLabel htmlFor={`live-icon-${icon}`} className="font-normal">
                        <Glyph aria-hidden="true" />
                        {icon}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </RadioGroup>
            </Action>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">State</FieldLegend>
            <div className="flex flex-wrap gap-6">
              <Field orientation="horizontal" className="w-auto">
                <Action id="playground.live.enable" kind="toggle">
                  <Checkbox id="live-enabled" />
                </Action>
                <FieldLabel htmlFor="live-enabled" className="font-normal">
                  Enabled
                </FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Action id="playground.live.show" kind="toggle">
                  <Checkbox id="live-visible" />
                </Action>
                <FieldLabel htmlFor="live-visible" className="font-normal">
                  Visible
                </FieldLabel>
              </Field>
            </div>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">Sample items</FieldLegend>
            <FieldDescription>
              Three Actions placed in the sidebar and in this card's playground.samples slot. Adding
              one makes the next visible.
            </FieldDescription>
            <div className="flex flex-wrap items-center gap-2">
              <Action id="playground.live.add">
                <Button variant="outline" size="sm" />
              </Action>
              <Action id="playground.live.remove">
                <Button variant="outline" size="sm" />
              </Action>
              {samples.items.map((item) => (
                <Action key={item.key} id={item.action}>
                  <Button variant="secondary" size="sm" />
                </Action>
              ))}
            </div>
          </FieldSet>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <code className="text-xs text-muted-foreground">
          actions/live/*.ts, actions/sample/*.ts, services/live.ts
        </code>
        <Action id="playground.live.reset">
          <Button variant="ghost" size="sm" />
        </Action>
      </CardFooter>
    </Card>
  );
}
