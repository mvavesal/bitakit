'use client';
import { ThemeColorField } from './color-field.js';
import { ThemeChoice } from './theme-choice.js';
import { flatButtonTokens } from './button-finish.js';
import { AppearanceField } from './appearance-field.js';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';
import SettingsIcon from 'reicon-react/icons/Settings';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import DownloadIcon from 'reicon-react/icons/Download';
import UploadIcon from 'reicon-react/icons/Upload';
import ResetIcon from 'reicon-react/icons/Undo';
import { useRef, useState, type ChangeEvent, type ComponentProps, type ReactNode } from 'react';
import {
  Action,
  useService,
  useSetting,
  useTranslation,
  type SettingsCatalogSection,
  type SettingsCatalogField,
} from '@bitakit/ui';
import {
  Button,
  Input,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSet,
  FieldLegend,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@bitakit/ui/components';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/card.js';
import { themeService, type ThemeService } from '../../services/themes.js';
import { ThemePreview, themePreviewStyle } from './theme-preview.js';
import { useAppThemeBaseline } from '../providers/theme.js';
import {
  parseThemeFile,
  stringifyThemeFile,
  type ShellThemeDefinition,
  type ThemeSource,
} from '../../themes.js';

/** A readable download name; the file content keeps the theme's own id. */
const fileName = (name: string) =>
  `${
    name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'theme'
  }.theme.json`;

/** Shell composition only; values and business operations stay in settings/services/actions. */
export function AppearanceSettings({
  section,
  renderField,
}: {
  section: SettingsCatalogSection;
  renderField?: (field: SettingsCatalogField) => ReactNode;
}) {
  const baseline = useAppThemeBaseline();
  const t = useTranslation();
  const text = (key: string, fallback: string) => t(`shell.ui.themes.${key}`, undefined, fallback);
  const sourceLabel = (source: ThemeSource) =>
    text(source, { shell: 'Included', app: 'App', user: 'Personal' }[source]);
  const library = useSetting('shell.themeLibrary');
  const mode = useSetting('shell.mode');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const service = useService(themeService) as ThemeService | undefined;
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [draft, setDraft] = useState<ShellThemeDefinition | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = service?.active();
  const editInCurrentMode = () =>
    setColorMode(
      mode.value === 'dark' ||
        (mode.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light',
    );
  function customize() {
    if (!active) return;
    setImportError(null);
    setEditingPersonal(active.source === 'user');
    editInCurrentMode();
    setDraft({
      schemaVersion: 1,
      id: active.source === 'user' ? active.id : crypto.randomUUID(),
      name: active.source === 'user' ? active.name : `${active.name} ${text('copy', 'copy')}`,
      shared: { ...active.shared },
      light: { ...active.light },
      dark: { ...active.dark },
    });
  }
  /** Downloads the theme shown in the preview: the open draft, otherwise the active theme. */
  function download() {
    const theme = draft ?? active;
    if (!theme) return;
    const url = URL.createObjectURL(
      new Blob([stringifyThemeFile(theme)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(theme.name);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }
  /** Opens a theme file as an unsaved personal copy; saving uses the existing copy Action. */
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const theme = parseThemeFile(await file.text());
      setImportError(null);
      setEditingPersonal(false);
      editInCurrentMode();
      setDraft({ ...theme, id: crypto.randomUUID() });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  }
  function token(group: 'shared' | 'light' | 'dark', name: string, label: string) {
    if (!draft) return null;
    const update = (value: string) => {
      const values = { ...draft[group] };
      if (value) values[name] = value;
      else delete values[name];
      setDraft({ ...draft, [group]: values });
    };
    const value = draft[group][name] ?? '';
    return (
      <ThemeColorField
        key={`${group}-${name}`}
        id={`theme-${group}-${name}`}
        label={label}
        value={value}
        inherited={baseline[group === 'dark' ? 'dark' : 'light'][name] ?? ''}
        onChange={update}
      />
    );
  }
  function shared(name: string, value: string) {
    if (!draft) return;
    const values = { ...draft.shared };
    if (value) values[name] = value;
    else delete values[name];
    setDraft({ ...draft, shared: values });
  }

  return (
    <div className="@container flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{text('display', 'Display')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-6">
            {section.fields
              .filter((field) => field.name === 'mode')
              .map((field) =>
                renderField ? (
                  renderField(field)
                ) : (
                  <AppearanceField key={field.key} field={field} />
                ),
              )}
          </FieldGroup>
        </CardContent>
      </Card>
      <div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle>{text('title', 'Themes')}</CardTitle>
            <CardDescription>
              {text(
                'description',
                'Choose a theme or save a personal copy. Original themes stay unchanged.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>{text('selected', 'Selected theme')}</FieldLabel>
                {/* The select on its own line, the theme's tools below it. */}
                <div className="flex flex-col items-start gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="w-full min-w-0 justify-between"
                        variant="outline"
                        disabled={!library.ready}
                      >
                        {active ? (
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="truncate">
                              {active.key === 'shell:default'
                                ? text('appDefault', 'App default')
                                : active.name}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {sourceLabel(active.key === 'shell:default' ? 'app' : active.source)}
                            </span>
                          </span>
                        ) : (
                          <span className="truncate">{text('loading', 'Loading themes…')}</span>
                        )}
                        <ChevronDownIcon aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 max-w-[calc(100vw-2rem)]"
                    >
                      <DropdownMenuGroup>
                        {service?.list().map((theme) => (
                          <Action
                            key={theme.key}
                            id="shell.selectTheme"
                            input={{ key: theme.key }}
                            onExecuted={(result) => {
                              if (result.status === 'completed' && result.value === 'saved')
                                setDraft(null);
                            }}
                            kind="menuItem"
                          >
                            <DropdownMenuItem className="justify-between gap-4">
                              <span className="min-w-0">
                                <span className="block break-words">
                                  {theme.key === 'shell:default'
                                    ? text('appDefault', 'App default')
                                    : theme.name}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {sourceLabel(
                                    theme.key === 'shell:default' ? 'app' : theme.source,
                                  )}
                                  {(service
                                    ?.list()
                                    .filter(
                                      (entry) =>
                                        entry.name === theme.name && entry.source === theme.source,
                                    ).length ?? 0) > 1
                                    ? ` · ${
                                        (service
                                          ?.list()
                                          .filter(
                                            (entry) =>
                                              entry.name === theme.name &&
                                              entry.source === theme.source,
                                          )
                                          .findIndex((entry) => entry.key === theme.key) ?? 0) + 1
                                      }`
                                    : ''}
                                </span>
                              </span>
                              <span
                                className="light pointer-events-none flex shrink-0 items-center gap-2"
                                aria-hidden="true"
                                style={themePreviewStyle(theme, 'light', baseline)}
                              >
                                <span
                                  className="rounded-md border border-border bg-card px-2 py-1"
                                  style={{ color: 'var(--card-foreground)' }}
                                >
                                  Aa
                                </span>
                                <Button
                                  asChild
                                  size="sm"
                                  style={{ color: 'var(--primary-foreground)' }}
                                >
                                  <span>Aa</span>
                                </Button>
                                <input
                                  type="radio"
                                  checked
                                  readOnly
                                  tabIndex={-1}
                                  aria-hidden="true"
                                  className="size-4"
                                  style={{ accentColor: 'var(--primary)' }}
                                />
                              </span>
                            </DropdownMenuItem>
                          </Action>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <TooltipProvider delayDuration={300}>
                    <div
                      role="toolbar"
                      aria-label={text('tools', 'Theme tools')}
                      className="inline-flex items-center gap-1"
                    >
                      <ThemeTool
                        label={text('customize', 'Customize theme')}
                        disabled={library.disabled}
                        onClick={customize}
                      >
                        <SettingsIcon aria-hidden="true" />
                      </ThemeTool>
                      <ThemeTool
                        label={text('import', 'Import theme')}
                        disabled={library.disabled}
                        onClick={() => fileInput.current?.click()}
                      >
                        <UploadIcon aria-hidden="true" />
                      </ThemeTool>
                      <ThemeTool
                        label={text('download', 'Download theme')}
                        disabled={!draft && (!active || active.key === 'shell:default')}
                        onClick={download}
                      >
                        <DownloadIcon aria-hidden="true" />
                      </ThemeTool>
                      <Action
                        id="shell.selectTheme"
                        input={{ key: 'shell:default' }}
                        onExecuted={(result) => {
                          if (result.status === 'completed' && result.value === 'saved')
                            setDraft(null);
                        }}
                      >
                        {(control) => (
                          <ThemeTool
                            label={text('resetDefault', 'Reset to default theme')}
                            {...control.props()}
                          >
                            <ResetIcon aria-hidden="true" />
                          </ThemeTool>
                        )}
                      </Action>
                    </div>
                  </TooltipProvider>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={importFile}
                  />
                </div>
                {importError && (
                  <FieldError>
                    {text('importError', 'This file is not a valid theme.')} {importError}
                  </FieldError>
                )}
              </Field>
            </FieldGroup>
          </CardContent>
          {draft && (
            <CardContent>
              <FieldSet className="min-w-0">
                <FieldLegend>{text('editor', 'Customize theme')}</FieldLegend>
                {!editingPersonal && (
                  <FieldDescription>
                    {text(
                      'copyNotice',
                      'You are editing a new personal copy. The original theme stays unchanged.',
                    )}
                  </FieldDescription>
                )}
                <FieldDescription>
                  {text(
                    'inherit',
                    'Leave a value empty to inherit the standard theme. Colors accept CSS values, including hex and oklch.',
                  )}
                </FieldDescription>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="theme-name">{text('name', 'Theme name')}</FieldLabel>
                    <Input
                      id="theme-name"
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                  </Field>
                  <div className="grid gap-6">
                    <ThemeChoice
                      preview="radius"
                      label={text('radius', 'Corner radius')}
                      value={draft.shared.radius ?? ''}
                      onChange={(value) => shared('radius', value)}
                      choices={[
                        { value: '0rem', label: text('square', 'Square') },
                        { value: '0.375rem', label: text('radiusSmall', 'Small') },
                        { value: '0.875rem', label: text('radiusMedium', 'Medium') },
                        { value: '1.5rem', label: text('radiusLarge', 'Large') },
                      ]}
                    />
                    <ThemeChoice
                      preview="shadow"
                      label={text('shadow', 'Surface shadow')}
                      value={draft.shared['theme-shadow-surface'] ?? ''}
                      onChange={(value) => shared('theme-shadow-surface', value)}
                      choices={[
                        { value: 'none', label: text('none', 'None') },
                        {
                          value: 'var(--shadow-xs)',
                          label: text('shadowExtraSmall', 'Extra small'),
                        },
                        { value: 'var(--shadow-sm)', label: text('shadowSmall', 'Small') },
                        { value: 'var(--shadow-md)', label: text('medium', 'Medium') },
                        { value: 'var(--shadow-lg)', label: text('shadowLarge', 'Large') },
                      ]}
                    />
                  </div>
                  <ThemeChoice
                    preview="font"
                    label={text('font', 'Font family')}
                    value={draft.shared['font-sans'] ?? ''}
                    onChange={(value) => shared('font-sans', value)}
                    choices={[
                      {
                        value: 'ui-sans-serif, system-ui, sans-serif',
                        label: text('systemFont', 'System sans-serif'),
                      },
                      { value: 'ui-serif, Georgia, serif', label: text('serifFont', 'Serif') },
                      { value: 'ui-monospace, monospace', label: text('monoFont', 'Monospace') },
                    ]}
                  />
                  <ThemeChoice
                    preview="button"
                    label={text('buttonFinish', 'Button style')}
                    value={draft.shared['theme-control-gradient'] === 'none' ? 'flat' : 'raised'}
                    onChange={(finish) => {
                      const values = { ...draft.shared };
                      for (const [key, value] of Object.entries(flatButtonTokens)) {
                        if (finish === 'flat') values[key] = value;
                        else delete values[key];
                      }
                      setDraft({ ...draft, shared: values });
                    }}
                    choices={[
                      { value: 'raised', label: text('raised', 'Raised · BitaKit') },
                      { value: 'flat', label: text('flat', 'Flat') },
                    ]}
                  />
                  <FieldSet>
                    <FieldLegend>{text('colors', 'Colors')}</FieldLegend>
                    <div
                      role="group"
                      aria-label={text('editColorScheme', 'Edit color scheme')}
                      className="flex gap-2"
                    >
                      {(['light', 'dark'] as const).map((variant) => (
                        <Button
                          key={variant}
                          size="sm"
                          variant={colorMode === variant ? 'secondary' : 'outline'}
                          aria-pressed={colorMode === variant}
                          onClick={() => setColorMode(variant)}
                        >
                          {variant === 'light' ? (
                            <SunIcon aria-hidden="true" />
                          ) : (
                            <MoonIcon aria-hidden="true" />
                          )}
                          {text(variant, variant === 'light' ? 'Light' : 'Dark')}
                        </Button>
                      ))}
                    </div>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          'background',
                          'foreground',
                          'primary',
                          'primary-foreground',
                          'card',
                          'card-foreground',
                          'border',
                          'ring',
                        ] as const
                      ).map((name) =>
                        token(
                          colorMode,
                          name,
                          text(
                            name,
                            {
                              background: 'Background',
                              foreground: 'Text',
                              primary: 'Primary',
                              'primary-foreground': 'Primary text',
                              card: 'Card',
                              'card-foreground': 'Card text',
                              border: 'Border',
                              ring: 'Focus ring',
                            }[name],
                          ),
                        ),
                      )}
                    </FieldGroup>
                  </FieldSet>
                </FieldGroup>
                <div className="flex flex-wrap justify-end gap-2">
                  {editingPersonal && (
                    <Action
                      id="shell.deleteTheme"
                      input={{ id: draft.id }}
                      onExecuted={(result) => {
                        if (result.status === 'completed' && result.value === 'saved')
                          setDraft(null);
                      }}
                    >
                      <Button variant="destructive" className="me-auto">
                        {text('delete', 'Delete theme')}
                      </Button>
                    </Action>
                  )}
                  <Button variant="outline" onClick={() => setDraft(null)}>
                    {text('cancel', 'Cancel')}
                  </Button>
                  <Action
                    id={editingPersonal ? 'shell.updateTheme' : 'shell.saveThemeCopy'}
                    input={draft}
                    onExecuted={(result) => {
                      if (result.status === 'completed' && result.value === 'saved')
                        setEditingPersonal(true);
                    }}
                  >
                    <Button>
                      {editingPersonal
                        ? text('save', 'Save and apply')
                        : text('saveCopy', 'Save copy and apply')}
                    </Button>
                  </Action>
                </div>
              </FieldSet>
            </CardContent>
          )}
        </Card>
        {active && (
          <ThemePreview
            theme={draft ?? active}
            editing={draft !== null}
            editMode={draft ? colorMode : undefined}
            onEditModeChange={setColorMode}
          />
        )}
      </div>
    </div>
  );
}

/** One tool of the theme toolbar: an icon button named by its tooltip (and for screen readers). */
function ThemeTool({
  label,
  children,
  ...button
}: { label: string; children: ReactNode } & ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={label} {...button}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
