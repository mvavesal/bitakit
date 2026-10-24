'use client';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { useSetting, useTranslation } from '@bitakit/ui';
import {
  Button,
  Input,
  Field,
  FieldLabel,
  FieldGroup,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Badge,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@bitakit/ui/components';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../components/ui/card.js';
import { themeTokens, type ShellThemeDefinition } from '../../themes.js';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';
import { useAppThemeBaseline } from '../providers/theme.js';
import { themeDefaults } from '../../theme-defaults.js';

/** Shared token scope for selected themes, draft previews and menu samples. */
export function themePreviewStyle(
  theme: ShellThemeDefinition,
  variant: 'light' | 'dark',
  baseline = themeDefaults,
): CSSProperties {
  const tokens = {
    ...baseline.light,
    ...(variant === 'dark' ? baseline.dark : {}),
    ...themeTokens(theme, variant),
  };
  return {
    ...Object.fromEntries(Object.entries(tokens).map(([key, value]) => [`--${key}`, value])),
    colorScheme: variant,
    fontFamily: 'var(--font-sans)',
  };
}

/** Local color-scheme controls never change the selected theme or save a draft. */
export function ThemePreview({
  theme,
  editing = false,
  editMode,
  onEditModeChange,
}: {
  theme: ShellThemeDefinition;
  editing?: boolean;
  editMode?: 'light' | 'dark';
  onEditModeChange?: (mode: 'light' | 'dark') => void;
}) {
  const inputId = useId();
  const mode = useSetting('shell.mode');
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | null>(null);
  const appDark = mode.value === 'dark' || (mode.value === 'system' && systemDark);
  const variant = editMode ?? previewMode ?? (appDark ? 'dark' : 'light');
  const dark = variant === 'dark';
  const baseline = useAppThemeBaseline();
  const style = themePreviewStyle(theme, variant, baseline);
  const t = useTranslation();
  const text = (key: string, fallback: string) => t(`shell.ui.themes.${key}`, undefined, fallback);
  return (
    <aside className="min-w-0 @3xl:sticky @3xl:top-4" aria-label={text('preview', 'Live preview')}>
      <div
        className="mb-3 flex gap-2"
        role="group"
        aria-label={text('previewMode', 'Preview color scheme')}
      >
        <Button
          variant={dark ? 'outline' : 'secondary'}
          size="sm"
          aria-pressed={!dark}
          onClick={() => (editMode ? onEditModeChange?.('light') : setPreviewMode('light'))}
        >
          <SunIcon aria-hidden="true" />
          {text('light', 'Light')}
        </Button>
        <Button
          variant={dark ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={dark}
          onClick={() => (editMode ? onEditModeChange?.('dark') : setPreviewMode('dark'))}
        >
          <MoonIcon aria-hidden="true" />
          {text('dark', 'Dark')}
        </Button>
      </div>
      <div className={dark ? 'dark' : 'light'} style={style}>
        <Card>
          <CardHeader>
            <CardTitle>{theme.name}</CardTitle>
            <CardDescription>
              {editing
                ? text('previewHint', 'Changes appear here before you save.')
                : text(
                    'selectedPreviewHint',
                    'Buttons, fields and surfaces in your selected theme.',
                  )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{text('sample', 'Sample')}</Badge>
            <Field>
              <FieldLabel htmlFor={inputId}>{text('sampleInput', 'Text input')}</FieldLabel>
              <Input id={inputId} placeholder={text('samplePlaceholder', 'Your workspace')} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button>{text('primaryButton', 'Primary')}</Button>
              <Button variant="secondary">{text('secondaryButton', 'Secondary')}</Button>
              <Button variant="outline">{text('outlineButton', 'Outline')}</Button>
            </div>
            <FieldGroup className="gap-3">
              <Field orientation="horizontal">
                <Checkbox id={`${inputId}-checkbox`} defaultChecked />
                <FieldLabel htmlFor={`${inputId}-checkbox`}>
                  {text('sampleCheckbox', 'Checkbox')}
                </FieldLabel>
              </Field>
              <RadioGroup
                defaultValue="one"
                aria-label={text('sampleRadioGroup', 'Radio buttons')}
                className="grid-cols-2"
              >
                {(['one', 'two'] as const).map((value) => (
                  <Field key={value} orientation="horizontal">
                    <RadioGroupItem id={`${inputId}-radio-${value}`} value={value} />
                    <FieldLabel htmlFor={`${inputId}-radio-${value}`}>
                      {value === 'one'
                        ? text('sampleRadioOne', 'Radio 1')
                        : text('sampleRadioTwo', 'Radio 2')}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">{text('previewDialog', 'Preview dialog')}</Button>
              </DialogTrigger>
              <DialogContent className={dark ? 'dark' : 'light'} style={style}>
                <DialogHeader>
                  <DialogTitle>{text('sampleDialog', 'Sample dialog')}</DialogTitle>
                  <DialogDescription>
                    {text(
                      'dialogHint',
                      'This dialog uses the colors, corners and typography shown in the preview.',
                    )}
                  </DialogDescription>
                </DialogHeader>
                <Input
                  aria-label={text('sampleInput', 'Text input')}
                  placeholder={text('samplePlaceholder', 'Your workspace')}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button>{text('close', 'Close')}</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>
    </aside>
  );
}
