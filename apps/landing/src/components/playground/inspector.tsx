'use client';
import { motion, useReducedMotion } from 'motion/react';
import RefreshIcon from 'reicon-react/icons/Refresh';
import CloseIcon from 'reicon-react/icons/Xmark';
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@bitakit/ui/components';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { defaults, type PlaygroundCommand, type PlaygroundState } from '@/playground/protocol';
import { languages, pickerOptions, pluginInfo, segmentedOptions } from './plugins';
import { topics, type Topic } from './topics';

type Options = readonly (readonly [string, string])[];
type CodeSelection = { plugin: string; plugins: string[]; onChange(plugin: string): void };

/**
 * The inspector shows the selected topic's controls from the app's reported state.
 * Commands, including Reset, are applied through BitaKit's own APIs inside the app.
 */
export function Inspector({
  topic,
  state,
  code,
  send,
  onClose,
}: {
  topic: Topic['id'];
  state: PlaygroundState | null;
  code?: CodeSelection;
  send(command: PlaygroundCommand): void;
  onClose(): void;
}) {
  const current = topics.find((entry) => entry.id === topic)!;
  const Icon = current.icon;
  const reduced = useReducedMotion();
  // Compare only reported values; disabled plugins can temporarily omit their settings.
  const needsReset =
    state !== null &&
    (state.plugins.some((entry) => !entry.enabled) ||
      state.locale !== defaults.locale ||
      (state.theme !== '' && state.theme !== defaults.theme) ||
      Object.entries(defaults.settings).some(
        ([key, value]) => key in state.settings && state.settings[key] !== value,
      ));
  return (
    <Card size="sm" className={needsReset ? 'gap-0 pb-0' : 'gap-0'}>
      {/* Title and explanation stay in place; only the controls scroll. */}
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4" />
          {current.label}
        </CardTitle>
        <CardDescription>{current.description}</CardDescription>
        <CardAction>
          <Button size="icon-xs" variant="ghost" aria-label="Close customization" onClick={onClose}>
            <CloseIcon aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <ScrollArea className="flex min-h-0 flex-1 flex-col overflow-hidden [&>[data-slot=scroll-area-viewport]]:min-h-0 [&>[data-slot=scroll-area-viewport]]:flex-1">
        <CardContent className="py-3">
          {state ? (
            <motion.div
              key={topic}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
            >
              <Controls topic={topic} state={state} code={code} send={send} />
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">Starting the app…</p>
          )}
        </CardContent>
      </ScrollArea>
      {needsReset && (
        <CardFooter className="justify-center border-t pb-2 [.border-t]:pt-2">
          <Button size="xs" variant="ghost" onClick={() => send({ type: 'bitakit:reset' })}>
            <RefreshIcon aria-hidden="true" />
            Reset to default
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function Controls({
  topic,
  state,
  code,
  send,
}: {
  topic: Topic['id'];
  state: PlaygroundState;
  code?: CodeSelection;
  send(command: PlaygroundCommand): void;
}) {
  const setting = (key: string) => (value: string) =>
    value && send({ type: 'bitakit:setting', key, value });
  const toggle = (key: keyof typeof segmentedOptions) => (
    <Field>
      <FieldLabel>{segmentedOptions[key].label}</FieldLabel>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        className="w-full"
        aria-label={segmentedOptions[key].label}
        value={String(state.settings[key] ?? '')}
        onValueChange={setting(key)}
      >
        {segmentedOptions[key].options.map(([option, text]) => (
          <ToggleGroupItem key={option} value={option} className="flex-1">
            {text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
  const select = (
    label: string,
    value: unknown,
    options: Options,
    onChange: (value: string) => void,
  ) => (
    <Field key={label}>
      <FieldLabel>{label}</FieldLabel>
      <Select value={String(value ?? '')} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="site-theme">
          <SelectGroup>
            {options.map(([option, text]) => (
              <SelectItem key={option} value={option}>
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );

  switch (topic) {
    case 'plugins':
      return (
        <ul className="flex flex-col gap-1">
          {state.plugins.map((entry) => (
            <li key={entry.id}>
              <Item variant="outline" size="xs">
                <ItemContent>
                  <ItemTitle>{pluginInfo[entry.id]?.name ?? entry.id}</ItemTitle>
                  <ItemDescription className="text-xs">
                    {pluginInfo[entry.id]?.role}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Switch
                    size="sm"
                    checked={entry.enabled}
                    aria-label={pluginInfo[entry.id]?.name ?? entry.id}
                    onCheckedChange={(enabled) =>
                      send({ type: 'bitakit:plugin', id: entry.id, enabled })
                    }
                  />
                </ItemActions>
              </Item>
            </li>
          ))}
        </ul>
      );
    case 'themes':
      return (
        <FieldGroup>
          {select(
            'Theme',
            state.theme,
            state.themes.map((theme) => [theme.key, theme.name] as const),
            (key) => send({ type: 'bitakit:theme', key }),
          )}
          {toggle('shell.mode')}
        </FieldGroup>
      );
    case 'layout':
      return (
        <FieldGroup>
          {toggle('shell.layout')}
          {Object.entries(pickerOptions).map(([key, { label, options }]) =>
            select(label, state.settings[key], options, setting(key)),
          )}
        </FieldGroup>
      );
    case 'language':
      return (
        <FieldGroup>
          {select('Language', state.locale, languages, (locale) =>
            send({ type: 'bitakit:locale', locale: locale as 'en' | 'de' }),
          )}
        </FieldGroup>
      );
    case 'code':
      if (!code) return null;
      return (
        <FieldGroup>
          {select(
            'Plugin',
            code.plugin,
            code.plugins.map((id) => [id, pluginInfo[id]?.name ?? id] as const),
            code.onChange,
          )}
        </FieldGroup>
      );
  }
}
