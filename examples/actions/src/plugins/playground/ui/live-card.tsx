'use client';
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
import { icons, places } from '../services/live';
import { Pill } from './groups';
import { glyphs } from './live-icon';

/**
 * The live Action and its controls. Every control below is an <Action> around a plain
 * component; none of them knows where the live Action is shown.
 */
export function LiveCard() {
  const current = useServiceState('playground.live', (state) => state, undefined);
  const samples = useSlot('playground.samples');
  return (
    <Card id="example-1" className="md:col-span-2">
      <CardHeader>
        <div>
          <Pill n={1} group="live" />
        </div>
        <CardTitle>One Action, every place</CardTitle>
        <CardDescription>
          The live Action is here, in the More menu and in the place you pick below. Every control
          is an Action that changes one field of its state, and every place follows as you type.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <Action id="playground.live.target">
              <Button size="lg" />
            </Action>
            <Action id="playground.live.find">
              <Button variant="outline" />
            </Action>
            <FieldDescription>
              {current?.visible
                ? `Clicked ${current.clicks} ${current.clicks === 1 ? 'time' : 'times'}`
                : 'Hidden everywhere. Tick Visible to bring it back.'}
            </FieldDescription>
          </Field>
          {/* Each field is bound to its Action: `value` fills it and every keystroke runs it. */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="live-title">Title</FieldLabel>
              <Action id="playground.live.rename">
                {(control) => (
                  <Input
                    id="live-title"
                    maxLength={24}
                    value={String(control.value ?? '')}
                    onChange={(event) => void control.execute(event.target.value)}
                  />
                )}
              </Action>
            </Field>
            <Field>
              <FieldLabel htmlFor="live-tooltip">Tooltip</FieldLabel>
              <Action id="playground.live.tooltip">
                {(control) => (
                  <Input
                    id="live-tooltip"
                    maxLength={60}
                    placeholder="Empty removes it"
                    value={String(control.value ?? '')}
                    onChange={(event) => void control.execute(event.target.value)}
                  />
                )}
              </Action>
            </Field>
          </div>
          <FieldSet>
            <FieldLegend variant="label">Place</FieldLegend>
            <FieldDescription>
              Besides this card and the More menu. A message and a bouncing icon show where it went.
            </FieldDescription>
            <Action id="playground.live.place" kind="choice">
              <RadioGroup aria-label="Place" className="flex flex-wrap gap-4">
                {places.map((place) => (
                  <Field key={place.value} orientation="horizontal" className="w-auto">
                    <RadioGroupItem value={place.value} id={`live-place-${place.value}`} />
                    <FieldLabel htmlFor={`live-place-${place.value}`} className="font-normal">
                      {place.label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </Action>
          </FieldSet>
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
