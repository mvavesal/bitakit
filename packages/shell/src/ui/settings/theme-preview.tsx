'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { useSetting, useTranslation } from '@bitakit/ui';
import { Button, Input, Field, FieldLabel, Badge, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@bitakit/ui/components';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card.js';
import { themeTokens, type ShellThemeDefinition } from '../../themes.js';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';
import { themeDefaults } from '../../theme-defaults.js';

/** Draft-only token scope; neither previews nor their portaled dialog save settings. */
export function ThemePreview({ theme }: { theme: ShellThemeDefinition }) {
  const mode = useSetting('shell.mode');
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | null>(null);
  const appDark = mode.value === 'dark' || (mode.value === 'system' && systemDark);
  const variant = previewMode ?? (appDark ? 'dark' : 'light');
  const dark = variant === 'dark';
  const tokens = { ...themeDefaults.light, ...(dark ? themeDefaults.dark : {}), ...themeTokens(theme, variant) };
  const style = Object.fromEntries(Object.entries(tokens).map(([key, value]) => [`--${key}`, value])) as CSSProperties;
  const t = useTranslation();
  const text = (key: string, fallback: string) => t(`shell.ui.themes.${key}`, undefined, fallback);
  return <aside className="min-w-0 xl:sticky xl:top-4" aria-label={text('preview', 'Live preview')}>
    <div className="mb-3 flex gap-2" role="group" aria-label={text('previewMode', 'Preview color scheme')}>
      <Button variant={dark ? 'outline' : 'secondary'} size="sm" aria-pressed={!dark} onClick={() => setPreviewMode('light')}><SunIcon aria-hidden="true" />{text('light', 'Light')}</Button>
      <Button variant={dark ? 'secondary' : 'outline'} size="sm" aria-pressed={dark} onClick={() => setPreviewMode('dark')}><MoonIcon aria-hidden="true" />{text('dark', 'Dark')}</Button>
    </div>
    <div className={dark ? 'dark' : 'light'} style={{ ...style, colorScheme: variant, fontFamily: 'var(--font-sans)' }}>
      <Card><CardHeader><CardTitle>{text('preview', 'Live preview')}</CardTitle><CardDescription>{text('previewHint', 'Changes appear here before you save.')}</CardDescription></CardHeader>
        <CardContent><Badge variant="secondary">{text('sample', 'Sample')}</Badge>
          <Field><FieldLabel htmlFor="theme-preview-input">{text('sampleInput', 'Text input')}</FieldLabel><Input id="theme-preview-input" placeholder={text('samplePlaceholder', 'Your workspace')} /></Field>
          <div className="flex flex-wrap gap-2"><Button>{text('primaryButton', 'Primary')}</Button><Button variant="secondary">{text('secondaryButton', 'Secondary')}</Button><Button variant="outline">{text('outlineButton', 'Outline')}</Button></div>
        </CardContent><CardFooter><Dialog><DialogTrigger asChild><Button variant="outline">{text('previewDialog', 'Preview dialog')}</Button></DialogTrigger>
          <DialogContent className={dark ? 'dark' : 'light'} style={{ ...style, colorScheme: variant, fontFamily: 'var(--font-sans)' }}><DialogHeader><DialogTitle>{text('sampleDialog', 'Sample dialog')}</DialogTitle><DialogDescription>{text('dialogHint', 'This dialog uses the unsaved theme colors, radius and typography.')}</DialogDescription></DialogHeader><Input aria-label={text('sampleInput', 'Text input')} placeholder={text('samplePlaceholder', 'Your workspace')} /><DialogFooter><DialogClose asChild><Button>{text('close', 'Close')}</Button></DialogClose></DialogFooter></DialogContent>
        </Dialog></CardFooter>
      </Card>
    </div>
  </aside>;
}
