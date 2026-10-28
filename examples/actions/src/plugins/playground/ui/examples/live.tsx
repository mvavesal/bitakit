'use client';
import { Action, ActionShortcutLabel, useServiceState } from '@bitakit/ui';
import {
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  RadioGroup,
  RadioGroupItem,
} from '@bitakit/ui/components';
import InfoIcon from 'reicon-react/icons/InfoCircle';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextField } from '@/components/ui/text-field';
import { icons, places } from '../../services/live';
import { docs } from '../docs';
import { LiveActions } from '../live-actions';
import { glyphs } from '../live-icon';

// Every control is a plain component inside <Action>: the Action gives it its value and runs
// with the new one. Nothing here touches the live Actions; they read the same state.
export function LiveExample() {
  const actions = useServiceState('playground.live', (state) => state.actions, []);
  const selected = useServiceState('playground.live', (state) => state.selected, 0);
  return (
    <FieldGroup>
      <Field orientation="horizontal" className="flex-wrap">
        <LiveActions />
        <Action id="playground.live.add">
          <Button variant="outline" />
        </Action>
        <Action id="playground.live.remove">
          <Button variant="ghost" />
        </Action>
      </Field>
      {/* The tabs choose which live Action the editor below changes. */}
      <Action id="playground.live.select" kind="choice">
        <Tabs className="gap-6">
          <TabsList
            variant="line"
            aria-label="Edit"
            className="w-full justify-start rounded-none border-b"
          >
            {actions.map((action, index) => (
              <TabsTrigger key={index} value={String(index)} className="flex-none">
                {action.title || `Action ${index + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={String(selected)}>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Where it shows</FieldLegend>
                <Action id="playground.live.places" kind="choice">
                  <CheckboxGroup aria-label="Places" options={places} />
                </Action>
                <Item variant="muted" size="sm">
                  <ItemMedia variant="icon">
                    <InfoIcon aria-hidden="true" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>These are sample places</ItemTitle>
                    <ItemDescription>
                      An Action can show in any slot: Shell&apos;s, another plugin&apos;s or one you
                      declare with defineSlot. List the slot in the Action&apos;s <code>slots</code>
                      , as actions/-live.ts does. Read more about{' '}
                      <a href={docs.slots} target="_blank" rel="noreferrer">
                        slots
                      </a>{' '}
                      and{' '}
                      <a href={`${docs.actions}#bindings`} target="_blank" rel="noreferrer">
                        binding Actions
                      </a>
                      .
                    </ItemDescription>
                  </ItemContent>
                </Item>
              </FieldSet>

              <FieldSet>
                <FieldLegend>How it looks</FieldLegend>
                <div className="grid gap-6 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="live-title">Title</FieldLabel>
                    <Action id="playground.live.title" kind="choice">
                      <TextField id="live-title" maxLength={24} />
                    </Action>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="live-tooltip">Tooltip</FieldLabel>
                    <Action id="playground.live.tooltip" kind="choice">
                      <TextField id="live-tooltip" maxLength={60} placeholder="Empty: no tooltip" />
                    </Action>
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Icon</FieldLabel>
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
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>How it behaves</FieldLegend>
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  {(
                    [
                      ['playground.live.enable', 'live-enabled', 'Enabled'],
                      ['playground.live.show', 'live-visible', 'Visible'],
                      ['playground.live.confirm', 'live-confirm', 'Ask first'],
                      ['playground.live.slow', 'live-slow', 'Takes a second'],
                    ] as const
                  ).map(([id, control, label]) => (
                    <Field key={id} orientation="horizontal" className="w-auto">
                      <Action id={id} kind="toggle">
                        <Checkbox id={control} />
                      </Action>
                      <FieldLabel htmlFor={control} className="font-normal">
                        {label}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
                <Field>
                  <FieldLabel htmlFor="live-message">Message after a run</FieldLabel>
                  <Action id="playground.live.message" kind="choice">
                    <TextField
                      id="live-message"
                      maxLength={60}
                      placeholder="Empty: “<title> ran”"
                    />
                  </Action>
                </Field>
                <FieldDescription>
                  Shortcut: <ActionShortcutLabel keys={`Alt+${selected + 1}`} /> runs it from
                  anywhere, with the same rules as a click.
                </FieldDescription>
              </FieldSet>
            </FieldGroup>
          </TabsContent>
        </Tabs>
      </Action>
    </FieldGroup>
  );
}
