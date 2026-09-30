'use client';
import { useTranslation } from '@bitakit/ui';
import type { SettingControlProps, TextSetting } from '@bitakit/app-preferences';
import { Input } from '@bitakit/ui/components';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group.js';
import { Field, FieldLabel } from '@bitakit/ui/components';

const presets = [
  { value: 'default', label: 'Standard' },
  { value: '#2563eb', label: 'Blau' },
  { value: '#7c3aed', label: 'Violett' },
  { value: '#059669', label: 'Grün' },
  { value: '#e11d48', label: 'Rose' },
  { value: '#ea580c', label: 'Orange' },
];

/** Native color selection and standard radio fields share the same preference write path. */
export function PrimaryColor(props: SettingControlProps<TextSetting>) {
  const t = useTranslation();
  const preset = presets.some((item) => item.value === props.value) ? props.value : 'custom';
  return (
    <div className="flex flex-col gap-4" id={props.id}>
      <RadioGroup
        value={preset}
        disabled={props.disabled}
        aria-labelledby={props.labelId}
        aria-describedby={props.describedBy}
        className="grid gap-3 sm:grid-cols-3"
        onValueChange={(value) => {
          if (value !== 'custom') void props.setValue(value);
        }}
      >
        {[
          ...presets.map((item, index) => ({ ...item, label: t(`shell.colors.p${index}`, undefined, item.label) })),
          ...(preset === 'custom' ? [{ value: 'custom', label: t("shell.ui.customColor", undefined, "Eigene Farbe") }] : []),
        ].map((item) => (
          <FieldLabel key={item.value} htmlFor={`${props.id}-${item.value}`}>
            <Field orientation="horizontal">
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-full border border-border"
                style={{
                  backgroundColor:
                    item.value === 'default'
                      ? 'var(--foreground)'
                      : item.value === 'custom'
                        ? props.value
                        : item.value,
                }}
              />
              <span className="flex-1">{item.label}</span>
              <RadioGroupItem id={`${props.id}-${item.value}`} value={item.value} aria-label={item.label} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      <Field orientation="horizontal">
        <FieldLabel htmlFor={`${props.id}-custom`}>{t("shell.ui.customColor", undefined, "Eigene Farbe")}</FieldLabel>
        <Input
          id={`${props.id}-custom`}
          type="color"
          className="w-20 shrink-0"
          value={props.value === 'default' ? '#2563eb' : props.value}
          disabled={props.disabled}
          aria-describedby={props.describedBy}
          aria-invalid={!!props.error}
          onChange={(event) => void props.setValue(event.target.value)}
        />
        <span className="text-sm text-muted-foreground">
          {props.value === 'default' ? t("shell.ui.themeDefault", undefined, "Theme-Vorgabe") : props.value.toUpperCase()}
        </span>
      </Field>
    </div>
  );
}
