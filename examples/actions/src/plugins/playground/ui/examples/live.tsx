'use client';
import { useState } from 'react';
import {
  Action,
  ActionShortcutLabel,
  useAction,
  useActionGroup,
  useServiceState,
} from '@bitakit/ui';
import {
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  RadioGroup,
  RadioGroupItem,
} from '@bitakit/ui/components';
import InfoIcon from 'reicon-react/icons/InfoCircle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { icons, type LiveConfig, type Place } from '../../live-action';
import { docs } from '../docs';

// The editor of the live Actions. Every control runs playground.live.edit with its change;
// ui/providers/live.tsx turns each configuration into an Action, so every place follows.
export function LiveExample() {
  const configs = useServiceState('playground.live', (state) => state.configs, []);
  const live = useActionGroup('playground.live');
  const edit = useAction('playground.live.edit');
  const [selected, setSelected] = useState(1);
  const config = configs.find((item) => item.number === selected) ?? configs[0];
  const change = (patch: Partial<LiveConfig>) =>
    config && void edit?.execute({ number: config.number, ...patch });
  // Ticking a place adds it to the list, unticking removes it.
  const place = (name: Place, on: boolean) =>
    config &&
    change({ places: on ? [...config.places, name] : config.places.filter((p) => p !== name) });
  return (
    <FieldGroup>
      <Field orientation="horizontal" className="flex-wrap">
        {live.items.map((item) => (
          <Action key={item.id} id={item}>
            <Button />
          </Action>
        ))}
        <Action id="playground.live.add">
          <Button variant="outline" />
        </Action>
      </Field>

      {config ? (
        <Tabs
          value={String(config.number)}
          onValueChange={(value) => setSelected(Number(value))}
          className="gap-6"
        >
          <TabsList
            variant="line"
            aria-label="Edit"
            className="w-full justify-start rounded-none border-b"
          >
            {configs.map((item) => (
              <TabsTrigger key={item.number} value={String(item.number)} className="flex-none">
                {item.title || 'Untitled'}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={String(config.number)}>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Where it shows</FieldLegend>
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="live-toolbar"
                      checked={config.places.includes('toolbar')}
                      onCheckedChange={(on) => place('toolbar', on === true)}
                    />
                    <FieldLabel htmlFor="live-toolbar" className="font-normal">
                      App bar
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="live-navigation"
                      checked={config.places.includes('navigation')}
                      onCheckedChange={(on) => place('navigation', on === true)}
                    />
                    <FieldLabel htmlFor="live-navigation" className="font-normal">
                      Sidebar
                    </FieldLabel>
                  </Field>
                </div>
                <Item variant="muted" size="sm">
                  <ItemMedia variant="icon">
                    <InfoIcon aria-hidden="true" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Two sample places</ItemTitle>
                    <ItemDescription>
                      An Action shows in any slot that takes Actions: list it in its{' '}
                      <code>slots</code>, as live-action.ts does with the app bar and the sidebar.
                      Read more about{' '}
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
                    <Input
                      id="live-title"
                      value={config.title}
                      onChange={(event) => change({ title: event.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="live-tooltip">Tooltip</FieldLabel>
                    <Input
                      id="live-tooltip"
                      value={config.tooltip}
                      placeholder="Empty: no tooltip"
                      onChange={(event) => change({ tooltip: event.target.value })}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Icon</FieldLabel>
                  <RadioGroup
                    aria-label="Icon"
                    className="flex flex-wrap gap-6"
                    value={config.icon}
                    onValueChange={(icon) => change({ icon: icon as LiveConfig['icon'] })}
                  >
                    {Object.entries(icons).map(([name, Glyph]) => (
                      <Field key={name} orientation="horizontal" className="w-auto">
                        <RadioGroupItem value={name} id={`live-icon-${name}`} />
                        <FieldLabel htmlFor={`live-icon-${name}`} className="font-normal">
                          <Glyph aria-hidden="true" />
                          {name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>How it behaves</FieldLegend>
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="live-enabled"
                      checked={config.enabled}
                      onCheckedChange={(on) => change({ enabled: on === true })}
                    />
                    <FieldLabel htmlFor="live-enabled" className="font-normal">
                      Enabled
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="live-visible"
                      checked={config.visible}
                      onCheckedChange={(on) => change({ visible: on === true })}
                    />
                    <FieldLabel htmlFor="live-visible" className="font-normal">
                      Visible
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="live-confirm"
                      checked={config.confirm}
                      onCheckedChange={(on) => change({ confirm: on === true })}
                    />
                    <FieldLabel htmlFor="live-confirm" className="font-normal">
                      Ask first
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-auto">
                    <Checkbox
                      id="live-slow"
                      checked={config.slow}
                      onCheckedChange={(on) => change({ slow: on === true })}
                    />
                    <FieldLabel htmlFor="live-slow" className="font-normal">
                      Takes a second
                    </FieldLabel>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="live-message">Message after a run</FieldLabel>
                  <Input
                    id="live-message"
                    value={config.message}
                    placeholder={`Empty: “${config.title || 'Untitled'} ran”`}
                    onChange={(event) => change({ message: event.target.value })}
                  />
                </Field>
                <Field orientation="horizontal" className="justify-between">
                  <FieldDescription>
                    Shortcut: <ActionShortcutLabel keys={`Alt+${config.number}`} />
                  </FieldDescription>
                  <Action id="playground.live.remove" input={config.number}>
                    <Button variant="ghost" size="sm" />
                  </Action>
                </Field>
              </FieldSet>
            </FieldGroup>
          </TabsContent>
        </Tabs>
      ) : (
        <FieldDescription>Press Add action to make one.</FieldDescription>
      )}
    </FieldGroup>
  );
}
