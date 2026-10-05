'use client';
import { useId, useState, type ReactNode } from 'react';
import { Frame, Target, Explanation, type Region } from './shared';
import regions from './regions.json';

const declaration = `import { defineSettings, setting } from '@bitakit/core';

export default defineSettings({
  step: setting({ default: 1 }),
});`;
function settingsExample(region: Region) {
  if (region.key === 'toolbar')
    return {
      file: 'counter/actions/reset.ts',
      code: `import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Reset step',
  visible: ({ input }) => input === 'counter',
  execute: ({ settings }) => settings.counter.step.set(1),
  slots: [{
    name: 'app-preferences.page.toolbar',
    input: ({ payload }) => payload.pageId,
  }],
});`,
    };
  if (region.key === 'body')
    return {
      file: 'counter/ui/settings/page.tsx',
      code: `'use client';
import { SettingField } from '@bitakit/app-preferences';

export default function CounterSettings() {
  return <SettingField settingKey="counter.step" />;
}`,
    };
  if (region.key === 'category' || region.key === 'heading')
    return {
      file: 'counter/settings.ts',
      code: `import { defineSettings, setting } from '@bitakit/core';

export default defineSettings({
  step: setting({ default: 1 }),
}, {
  title: 'Counter',
  category: 'general',
});`,
    };
  if (['header', 'before', 'after', 'footer', 'navigationFooter'].includes(region.key)) {
    const scoped = region.key !== 'navigationFooter';
    return {
      file: `help/ui/slots/${region.slot}.tsx`,
      code: `${
        scoped
          ? `import type { SlotPredicate } from '@bitakit/core';

export const when: SlotPredicate<'${region.slot}'> =
  ({ payload }) => payload.pageId === 'counter';

`
          : ''
      }export default function Help() {
  return <p>Learn how the counter works.</p>;
}`,
    };
  }
  return { file: 'counter/settings.ts', code: declaration };
}

export function SettingsIllustration() {
  const [selected, select] = useState('setting');
  const details = useId();
  const current: Region = regions.settings.find((item) => item.key === selected)!;
  const target = (key: string, children?: ReactNode) => (
    <Target
      region={regions.settings.find((item) => item.key === key)!}
      selected={selected}
      select={select}
      controls={details}
    >
      {children}
    </Target>
  );
  return (
    <Frame
      label="Explore Settings regions"
      caption="Select any labeled region to see its source and extension contract. Dashed outlines identify slot outlets. This is a documentation model, not a running settings editor."
    >
      <p className="text-sm font-medium">Select a part of the Settings page</p>
      <div className="grid min-w-0 gap-4 rounded-xl border border-fd-border bg-fd-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-3 border-b border-fd-border pb-4 sm:border-e sm:border-b-0 sm:pe-4 sm:pb-0">
          <p className="font-semibold">Settings navigation</p>
          {target(
            'category',
            <>
              <span className="block text-xs">Settings category</span>
              <span>General</span>
            </>,
          )}
          {target(
            'navigation',
            <>
              <span className="block text-xs">Settings navigation item</span>
              <span>Counter</span>
            </>,
          )}
          <div className="mt-auto pt-4">{target('navigationFooter')}</div>
        </div>
        <div className="min-w-0 space-y-3">
          {target(
            'heading',
            <>
              <span className="block text-xs">Settings page header · title</span>
              <span className="text-xl font-semibold">Counter</span>
            </>,
          )}
          {target('header')}
          {target('toolbar')}
          {target('before')}
          <div className="space-y-3 rounded-lg border border-fd-border p-3">
            {target('body')}
            {target(
              'setting',
              <>
                <span className="block text-xs">Setting field</span>
                <span className="mt-2 flex justify-between gap-3">
                  <span>Step</span>
                  <span className="rounded-md border border-fd-border px-3">1</span>
                </span>
              </>,
            )}
          </div>
          {target('after')}
          {target('footer')}
        </div>
      </div>
      <Explanation id={details} region={current} {...settingsExample(current)} />
    </Frame>
  );
}
