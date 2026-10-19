'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { Frame, Explanation, targetStyle } from './shared';
import regions from './regions.json';

export function SlotIllustration() {
  const [selected, select] = useState('navigation');
  const details = useId();
  const current = regions.shell.find((item) => item.key === selected)!;
  const widget = current.accepts === 'component';
  const code = widget
    ? `import { ActionLink } from '@bitakit/ui';

export default function ExampleActionLink() {
  return <ActionLink action="example.open" />;
}`
    : `import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Your action',
  href: '/example',
  slots: ['${current.slot}'],
});`;
  const placement = (key: string) => (
    <button
      type="button"
      aria-label={`Place example Action in ${regions.shell.find((item) => item.key === key)!.label}`}
      aria-pressed={key === selected}
      aria-controls={details}
      onClick={() => select(key)}
      className={`${targetStyle(key === selected, true)} flex flex-wrap items-center justify-between gap-2`}
    >
      <span>{regions.shell.find((item) => item.key === key)!.label}</span>
      {selected === key && (
        <span className="rounded-md bg-fd-primary px-2 py-1 font-medium text-fd-primary-foreground">
          Your action
        </span>
      )}
    </button>
  );
  return (
    <Frame
      label="Explore Action placement"
      caption="Choose a destination: the highlighted sample Action moves and the authoring example changes. This is an illustrative preview; it does not navigate or mutate your app."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Action destination">
        {regions.shell.map((region) => (
          <button
            key={region.key}
            type="button"
            aria-pressed={selected === region.key}
            aria-controls={details}
            className={buttonVariants({
              color: selected === region.key ? 'primary' : 'outline',
              size: 'sm',
            })}
            onClick={() => select(region.key)}
          >
            {region.label}
          </button>
        ))}
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
        <div
          role="region"
          aria-label="App header layout"
          tabIndex={0}
          className="overflow-x-auto border-b border-fd-border focus-visible:outline-2 focus-visible:outline-fd-ring"
        >
          <div className="grid min-w-xl grid-cols-[1fr_1fr_2fr] items-stretch gap-2 p-3">
            {placement('headerStart')}
            {placement('headerCenter')}
            <div className="flex min-w-0 items-stretch gap-2">
              {placement('toolbar')}
              {placement('headerEnd')}
            </div>
          </div>
        </div>
        <div className="grid min-h-52 grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex min-w-0 flex-col gap-3 border-e border-fd-border p-3">
            <span className="font-semibold">App sidebar</span>
            {placement('navigation')}
            <div className="mt-auto pt-4">{placement('navigationFooter')}</div>
          </div>
          <div className="space-y-3 p-4">
            <p className="font-medium">Your plugin page</p>
            <p className="text-sm text-fd-muted-foreground">
              The owner renders this content. Moving the sample Action does not change the page.
            </p>
          </div>
        </div>
        <div className="border-t border-fd-border p-3">{placement('footer')}</div>
      </div>
      <p className="text-sm text-fd-muted-foreground">
        The built-in toolbar sits beside custom header-end content in the same row. For a separate
        full-width row below the header, use{' '}
        <Link
          href="/docs/reference/layouts#2-add-another-header-row"
          className="underline underline-offset-4"
        >
          <code>shell.header.rows</code>
        </Link>
        . On narrow screens, scroll the header illustration sideways to see all regions.
      </p>
      <Explanation
        id={details}
        region={current}
        file={widget ? `example/ui/slots/${current.slot}.tsx` : 'example/actions/open.ts'}
        code={code}
      />
      {widget && (
        <p className="text-sm text-fd-muted-foreground">
          Keep the same <code>example.open</code> Action with <code>title</code> and{' '}
          <code>href</code>. Its <code>slots</code> property can be omitted when only the widget
          places it. Header and footer accept components, so bind the Action inside that component.
        </p>
      )}
    </Frame>
  );
}
