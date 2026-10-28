'use client';
import { Action, useServiceState } from '@bitakit/ui';
import {
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  RadioGroup,
  RadioGroupItem,
} from '@bitakit/ui/components';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { TextField } from '@/components/ui/text-field';
import { icons, places } from '../../services/live';
import { LiveActions } from '../live-actions';
import { glyphs } from '../live-icon';

// Every control is a plain component inside <Action>: the Action gives it its value and runs
// with the new one. Nothing here touches the live Actions; they read the same state.
export function LiveExample() {
  const actions = useServiceState('playground.live', (state) => state.actions, []);
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
      {actions.length === 0 ? (
        <FieldDescription>
          Add an Action, then pick where it shows and change it: every place follows as you type.
        </FieldDescription>
      ) : (
        <>
          <Field>
            <FieldLabel>Edit</FieldLabel>
            <Action id="playground.live.select" kind="choice">
              <RadioGroup aria-label="Edit" className="flex flex-wrap gap-4">
                {actions.map((action, index) => (
                  <Field key={index} orientation="horizontal" className="w-auto">
                    <RadioGroupItem value={String(index)} id={`live-edit-${index}`} />
                    <FieldLabel htmlFor={`live-edit-${index}`} className="font-normal">
                      {action.title || `Action ${index + 1}`}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </Action>
          </Field>
          <Field>
            <FieldLabel>Places</FieldLabel>
            <Action id="playground.live.places" kind="choice">
              <CheckboxGroup aria-label="Places" options={places} />
            </Action>
          </Field>
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
          <Field orientation="horizontal">
            <Action id="playground.live.enable" kind="toggle">
              <Checkbox id="live-enabled" />
            </Action>
            <FieldLabel htmlFor="live-enabled" className="font-normal">
              Enabled
            </FieldLabel>
          </Field>
        </>
      )}
    </FieldGroup>
  );
}
