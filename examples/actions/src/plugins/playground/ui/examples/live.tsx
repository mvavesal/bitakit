'use client';
import { Action, ActionShortcutLabel, useAction, useServiceState } from '@bitakit/ui';
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
import { initial, type Live } from '../../services/live';
import { docs } from '../docs';
import { glyphs } from '../live-icon';

const icons = Object.keys(glyphs) as Live['icon'][];

// The editor of the live Action. Each control runs one Action, playground.edit, with its change.
export function LiveExample() {
  const live = useServiceState('playground.live', (state) => state, initial);
  const edit = useAction('playground.edit');
  const change = (patch: Partial<Live>) => void edit?.execute(patch);
  return (
    <FieldGroup>
      <Field orientation="horizontal" className="flex-wrap">
        <Action id="playground.live">
          <Button size="lg" />
        </Action>
        <FieldDescription>
          {live.visible ? (
            <>
              Also in the {live.place === 'toolbar' ? 'app bar' : 'sidebar'}. Shortcut:{' '}
              <ActionShortcutLabel keys="Alt+1" />.
            </>
          ) : (
            'Hidden everywhere. Tick Visible to bring it back.'
          )}
        </FieldDescription>
      </Field>

      <FieldSet>
        <FieldLegend>Where it shows</FieldLegend>
        <RadioGroup
          aria-label="Where it shows"
          className="flex flex-wrap gap-6"
          value={live.place}
          onValueChange={(place) => change({ place: place as Live['place'] })}
        >
          <Field orientation="horizontal" className="w-auto">
            <RadioGroupItem value="toolbar" id="live-toolbar" />
            <FieldLabel htmlFor="live-toolbar" className="font-normal">
              App bar
            </FieldLabel>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <RadioGroupItem value="navigation" id="live-navigation" />
            <FieldLabel htmlFor="live-navigation" className="font-normal">
              Sidebar
            </FieldLabel>
          </Field>
        </RadioGroup>
        <Item variant="muted" size="sm">
          <ItemMedia variant="icon">
            <InfoIcon aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Two sample places</ItemTitle>
            <ItemDescription>
              An Action shows in any slot that takes Actions: list it in its <code>slots</code>, as
              actions/live.ts does with the app bar and the sidebar. Read more about{' '}
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
              value={live.title}
              onChange={(event) => change({ title: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="live-tooltip">Tooltip</FieldLabel>
            <Input
              id="live-tooltip"
              value={live.tooltip}
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
            value={live.icon}
            onValueChange={(icon) => change({ icon: icon as Live['icon'] })}
          >
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
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend>How it behaves</FieldLegend>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="live-enabled"
              checked={live.enabled}
              onCheckedChange={(on) => change({ enabled: on === true })}
            />
            <FieldLabel htmlFor="live-enabled" className="font-normal">
              Enabled
            </FieldLabel>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="live-visible"
              checked={live.visible}
              onCheckedChange={(on) => change({ visible: on === true })}
            />
            <FieldLabel htmlFor="live-visible" className="font-normal">
              Visible
            </FieldLabel>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="live-confirm"
              checked={live.confirm}
              onCheckedChange={(on) => change({ confirm: on === true })}
            />
            <FieldLabel htmlFor="live-confirm" className="font-normal">
              Ask first
            </FieldLabel>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="live-slow"
              checked={live.slow}
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
            value={live.message}
            placeholder="Empty: “The live Action ran”"
            onChange={(event) => change({ message: event.target.value })}
          />
        </Field>
      </FieldSet>
    </FieldGroup>
  );
}
