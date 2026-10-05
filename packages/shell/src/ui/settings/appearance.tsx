'use client';
import { ThemeColorField } from './color-field.js';
import { ThemeChoice } from './theme-choice.js';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';
import SettingsIcon from 'reicon-react/icons/Settings';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import { useState, type ReactNode } from 'react';
import { Action, useService, useSetting, useTranslation, type SettingsCatalogSection, type SettingsCatalogField } from '@bitakit/ui';
import { Button, Input, Field, FieldLabel, FieldDescription, FieldGroup, FieldSet, FieldLegend, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@bitakit/ui/components';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.js';
import { themeService, type ThemeService } from '../../services/themes.js';
import { ThemePreview } from './theme-preview.js';
import { themeDefaults } from '../../theme-defaults.js';
import type { ShellThemeDefinition } from '../../themes.js';

function AppearanceField({ field }: { field: SettingsCatalogField }) {
  const setting = useSetting(field.key);
  const [error, setError] = useState('');
  const selected = (field.options ?? []).find((option) => option.value === setting.value);
  return <Field><FieldLabel>{field.label}</FieldLabel>
    {field.description && <FieldDescription>{field.description}</FieldDescription>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button className="w-fit" variant="outline" disabled={setting.disabled}>{selected?.label ?? String(setting.value)}<ChevronDownIcon aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuGroup>{(field.options ?? []).map((option) => <DropdownMenuItem key={String(option.value)} onSelect={() => {
        setError(''); void setting.set(option.value).catch((reason) => setError(String(reason)));
      }}>{option.label ?? String(option.value)}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu>{error && <FieldDescription role="alert">{error}</FieldDescription>}
  </Field>;
}

/** Shell composition only; values and business operations stay in settings/services/actions. */
export function AppearanceSettings({ section, renderField }: { section: SettingsCatalogSection; renderField?: (field: SettingsCatalogField) => ReactNode }) {
  const t = useTranslation();
  const text = (key: string, fallback: string) => t(`shell.ui.themes.${key}`, undefined, fallback);
  const library = useSetting('shell.themeLibrary');
  const service = useService(themeService) as ThemeService | undefined;
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [draft, setDraft] = useState<ShellThemeDefinition | null>(null);
  const active = service?.active();
  function customize() {
    if (!active) return;
    setEditingPersonal(active.source === 'user');
    setDraft({ schemaVersion: 1, id: active.source === 'user' ? active.id : crypto.randomUUID(), name: active.source === 'user' ? active.name : `${active.name} ${text('copy', 'copy')}`, shared: { ...active.shared }, light: { ...active.light }, dark: { ...active.dark } });
  }
  function token(group: 'shared' | 'light' | 'dark', name: string, label: string, placeholder: string) {
    if (!draft) return null;
    const update = (value: string) => {
      const values = { ...draft[group] };
      if (value) values[name] = value; else delete values[name];
      setDraft({ ...draft, [group]: values });
    };
    const value = draft[group][name] ?? '';
    return <ThemeColorField key={`${group}-${name}`} id={`theme-${group}-${name}`} label={label} value={value} inherited={themeDefaults[group === 'dark' ? 'dark' : 'light'][name] ?? ''} onChange={update} />;
  }
  function shared(name: string, value: string) {
    if (!draft) return;
    const values = { ...draft.shared };
    if (value) values[name] = value; else delete values[name];
    setDraft({ ...draft, shared: values });
  }

  return <div className="flex flex-col gap-6">
    <Card><CardHeader><CardTitle>{text('display', 'Display and layout')}</CardTitle></CardHeader>
      <CardContent><FieldGroup className="gap-6">{section.fields.filter((field) => !['corners', 'preset'].includes(field.name)).map((field) => <div key={field.key} className="flex items-end gap-2"><div className="min-w-0 flex-1">{renderField ? renderField(field) : <AppearanceField field={field} />}</div>{field.name === 'toasts' && <Action id="shell.testNotification" input={{ message: text('testNotificationMessage', 'This is a test notification.') }}><Button variant="outline">{text('testNotification', 'Test')}</Button></Action>}</div>)}</FieldGroup></CardContent>
    </Card>
    <Card><CardHeader><CardTitle>{text('title', 'Themes')}</CardTitle><CardDescription>{text('description', 'Choose a theme or save a personal copy. Original themes stay unchanged.')}</CardDescription></CardHeader>
      <CardContent><FieldGroup><Field><FieldLabel>{text('selected', 'Selected theme')}</FieldLabel>
        <div className="flex flex-wrap items-center gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button className="w-full min-w-0 justify-between sm:w-80" variant="outline" disabled={!library.ready}><span className="truncate">{active ? `${active.name} · ${text(active.source, active.source)}` : text('loading', 'Loading themes…')}</span><ChevronDownIcon aria-hidden="true" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 max-w-[calc(100vw-2rem)]"><DropdownMenuGroup>{service?.list().map((theme) => <Action key={theme.key} id="shell.selectTheme" input={{ key: theme.key }} kind="menuItem"><DropdownMenuItem className="justify-between gap-4">
              <span className="min-w-0"><span className="block break-words">{theme.name}</span><span className="block text-xs text-muted-foreground">{text(theme.source, theme.source)}{(service?.list().filter((entry) => entry.name === theme.name && entry.source === theme.source).length ?? 0) > 1 ? ` · ${(service?.list().filter((entry) => entry.name === theme.name && entry.source === theme.source).findIndex((entry) => entry.key === theme.key) ?? 0) + 1}` : ''}</span></span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden="true">{(['background', 'foreground', 'primary', 'secondary'] as const).map((color) => <span key={color} className="size-4 rounded-full border border-border" style={{ backgroundColor: theme.light[color] ?? theme.shared[color] ?? themeDefaults.light[color] }} />)}</span>
            </DropdownMenuItem></Action>)}</DropdownMenuGroup></DropdownMenuContent>
        </DropdownMenu><Button variant="outline" size="icon" aria-label={text('customize', 'Customize theme')} disabled={library.disabled} onClick={customize}><SettingsIcon aria-hidden="true" /></Button><Action id="shell.selectTheme" input={{ key: 'shell:default' }} onExecuted={(result) => { if (result.status === 'completed' && result.value === 'saved') setDraft(null); }}><Button variant="outline">{text('resetDefault', 'Reset to default theme')}</Button></Action></div>
      </Field></FieldGroup></CardContent>
    {draft && <CardContent> <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]"><FieldSet className="min-w-0"><FieldLegend>{text('editor', 'Customize theme')}</FieldLegend>{!editingPersonal && <FieldDescription>{text('copyNotice', 'You are editing a new personal copy. The original theme stays unchanged.')}</FieldDescription>}<FieldDescription>{text('inherit', 'Leave a value empty to inherit the standard theme. Colors accept CSS values, including hex and oklch.')}</FieldDescription>
      <FieldGroup><Field><FieldLabel htmlFor="theme-name">{text('name', 'Theme name')}</FieldLabel><Input id="theme-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <ThemeChoice label={text('radius', 'Corner radius')} value={draft.shared.radius ?? ''} onChange={(value) => shared('radius', value)} choices={[
            { value: '0rem', label: text('square', 'Square') }, { value: '0.375rem', label: text('radiusSmall', 'Small') }, { value: '0.875rem', label: text('radiusMedium', 'Medium') }, { value: '1.5rem', label: text('radiusLarge', 'Large') },
          ]} />
          <ThemeChoice label={text('shadow', 'Surface shadow')} value={draft.shared['theme-shadow-surface'] ?? ''} onChange={(value) => shared('theme-shadow-surface', value)} choices={[
            { value: 'none', label: text('none', 'None') }, { value: 'var(--shadow-xs)', label: text('shadowExtraSmall', 'Extra small') }, { value: 'var(--shadow-sm)', label: text('shadowSmall', 'Small') }, { value: 'var(--shadow-md)', label: text('medium', 'Medium') }, { value: 'var(--shadow-lg)', label: text('shadowLarge', 'Large') },
          ]} />
        </div>
        <ThemeChoice label={text('font', 'Font family')} value={draft.shared['font-sans'] ?? ''} onChange={(value) => shared('font-sans', value)} choices={[
          { value: 'ui-sans-serif, system-ui, sans-serif', label: text('systemFont', 'System sans-serif') },
          { value: 'ui-serif, Georgia, serif', label: text('serifFont', 'Serif') },
          { value: 'ui-monospace, monospace', label: text('monoFont', 'Monospace') },
        ]} />
        <div className="grid items-start gap-6 lg:grid-cols-2">{(['light', 'dark'] as const).map((mode) => <FieldSet key={mode} className="min-w-0"><FieldLegend><span className="flex items-center gap-2">{mode === 'light' ? <SunIcon className="size-4" aria-hidden="true" /> : <MoonIcon className="size-4" aria-hidden="true" />}{text(mode, mode === 'light' ? 'Light' : 'Dark')}</span></FieldLegend><FieldGroup className="gap-4">{(['background', 'foreground', 'primary', 'primary-foreground', 'card', 'card-foreground', 'border', 'ring'] as const).map((name) => token(mode, name, text(name, name), text('inherited', 'Inherited')))}</FieldGroup></FieldSet>)}</div>
      </FieldGroup><div className="flex flex-wrap justify-end gap-2">{editingPersonal && <Action id="shell.deleteTheme" input={{ id: draft.id }} onExecuted={(result) => { if (result.status === 'completed' && result.value === 'saved') setDraft(null); }}><Button variant="destructive" className="me-auto">{text('delete', 'Delete theme')}</Button></Action>}<Button variant="outline" onClick={() => setDraft(null)}>{text('cancel', 'Cancel')}</Button><Action id={editingPersonal ? "shell.updateTheme" : "shell.saveThemeCopy"} input={draft} onExecuted={(result) => { if (result.status === 'completed' && result.value === 'saved') setEditingPersonal(true); }}><Button>{editingPersonal ? text('save', 'Save and apply') : text('saveCopy', 'Save copy and apply')}</Button></Action></div>
    </FieldSet><ThemePreview theme={draft} /></div></CardContent>}
    </Card>
  </div>;
}
