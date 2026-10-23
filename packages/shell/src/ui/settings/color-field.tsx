'use client';
import { useEffect, useState } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { formatHex8 } from 'culori';
import PipetteIcon from 'reicon-react/icons/Pipette';
import CopyIcon from 'reicon-react/icons/Copy';
import CheckIcon from 'reicon-react/icons/Check';
import { useTranslation } from '@bitakit/ui';
import { Button, Field, FieldLabel, FieldDescription } from '@bitakit/ui/components';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../../components/ui/input-group.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.js';

export function ThemeColorField({
  id,
  label,
  value,
  inherited,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  inherited: string;
  onChange(value: string): void;
}) {
  const t = useTranslation();
  const text = (key: string, fallback: string) => t(`shell.ui.themes.${key}`, undefined, fallback);
  const effective = value || inherited;
  const [eyeDropperAvailable, setEyeDropperAvailable] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState(false);
  useEffect(() => {
    setEyeDropperAvailable('EyeDropper' in window);
  }, []);
  async function pickFromScreen() {
    const EyeDropper = (
      window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
    ).EyeDropper;
    if (!EyeDropper) return;
    setPicking(true);
    setPickError(false);
    try {
      const result = await new EyeDropper().open();
      onChange(result.sRGBHex);
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setPickError(true);
    } finally {
      setPicking(false);
    }
  }
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setCopied(false);
    setError(false);
  }, [effective]);
  async function copy() {
    try {
      const hex = formatHex8(effective);
      if (!hex) throw new Error('Color cannot be converted');
      await navigator.clipboard.writeText(hex.endsWith('ff') ? hex.slice(0, 7) : hex);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Popover>
        <InputGroup>
          <InputGroupAddon>
            <PopoverTrigger asChild>
              <InputGroupButton
                size="icon-xs"
                aria-label={`${label} ${text('picker', 'color picker')}`}
              >
                <span
                  className="size-4 rounded-sm border border-input"
                  style={{ backgroundColor: effective }}
                />
              </InputGroupButton>
            </PopoverTrigger>
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            value={value}
            placeholder={formatHex8(inherited) ?? inherited}
            onChange={(event) => onChange(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              className="text-muted-foreground"
              onClick={() => void copy()}
              aria-label={copied ? text('copied', 'Copied') : text('copyColor', 'Copy color')}
            >
              {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <PopoverContent className="w-fit" aria-label={`${label} ${text('picker', 'color picker')}`}>
          <HexAlphaColorPicker color={formatHex8(effective) ?? '#000000ff'} onChange={onChange} />
          <Button
            variant="outline"
            size="sm"
            disabled={!eyeDropperAvailable || picking}
            onClick={() => void pickFromScreen()}
          >
            <PipetteIcon aria-hidden="true" />
            {text('pickScreen', 'Pick from screen')}
          </Button>
          {!eyeDropperAvailable && (
            <FieldDescription>
              {text(
                'eyedropperUnavailable',
                'Screen color picking is not supported in this browser.',
              )}
            </FieldDescription>
          )}
          {pickError && (
            <FieldDescription role="alert">
              {text('eyedropperFailed', 'Could not pick a screen color. Try again.')}
            </FieldDescription>
          )}
        </PopoverContent>
      </Popover>
      <span role="status" className="sr-only">
        {copied ? text('copied', 'Copied') : ''}
      </span>
      {error && (
        <FieldDescription role="alert">
          {text('copyFailed', 'Could not copy. Select and copy the color value manually.')}
        </FieldDescription>
      )}
    </Field>
  );
}
