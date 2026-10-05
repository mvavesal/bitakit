'use client';
import { useId, useState } from 'react';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { Frame, Explanation, targetStyle } from './shared';

const extensionSteps = [
  {
    key: 'define',
    label: '1. Define the slot',
    explanation:
      'The Counter plugin declares a place that accepts components. Discovery names it counter.footer. The declaration alone does not put anything on the page.',
    file: 'counter/slots/footer.ts',
    code: `import { defineSlot } from '@bitakit/core';

export default defineSlot({ accepts: 'component' });`,
  },
  {
    key: 'render',
    label: '2. Choose its position',
    explanation:
      'Your own component decides where the footer belongs. Use CounterPanel around your existing content; PluginSlot renders contributions at this position.',
    file: 'counter/ui/counter-panel.tsx',
    code: `'use client';
import type { ReactNode } from 'react';
import { PluginSlot } from '@bitakit/ui';

export default function CounterPanel({ children }: { children: ReactNode }) {
  return (
    <section>
      {children}
      <PluginSlot name="counter.footer" />
    </section>
  );
}`,
  },
  {
    key: 'contribute',
    label: '3. Add a plugin widget',
    explanation:
      'The Notes plugin targets counter.footer by filename. When both plugins are ready and the outlet is mounted, its widget appears inside CounterPanel. CounterPanel needs no changes.',
    file: 'notes/ui/slots/counter.footer.tsx',
    code: `export default function CounterNote() {
  return <p>The count is stored in memory.</p>;
}`,
  },
];

export function ExtensionIllustration() {
  const [selected, select] = useState('define');
  const details = useId();
  const step = extensionSteps.find((item) => item.key === selected)!;
  return (
    <Frame
      label="Build your own extension point"
      caption="Illustrative preview: choose a step to see what changes. The dashed outline marks the slot for learning; PluginSlot itself adds no visible frame."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Extension point steps">
        {extensionSteps.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected === item.key}
            aria-controls={details}
            className={buttonVariants({
              color: selected === item.key ? 'primary' : 'outline',
              size: 'sm',
            })}
            onClick={() => select(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="space-y-4 rounded-xl border border-fd-border bg-fd-card p-4">
        <div className="space-y-1">
          <p className="font-semibold">Your component: CounterPanel</p>
          <p className="text-sm text-fd-muted-foreground">
            Owned by the Counter plugin. Its existing content stays here.
          </p>
        </div>
        <p>Count: 0</p>
        {selected === 'define' ? (
          <p className="text-sm text-fd-muted-foreground">
            Slot declared. Choose its position in step 2 to let widgets appear here.
          </p>
        ) : (
          <button
            type="button"
            className={targetStyle(selected === 'contribute', true)}
            aria-label="Show how the Notes plugin adds a widget here"
            aria-pressed={selected === 'contribute'}
            aria-controls={details}
            onClick={() => select('contribute')}
          >
            <span className="block font-mono text-xs">counter.footer</span>
            {selected === 'contribute' ? (
              <>
                <span className="mt-2 block">The count is stored in memory.</span>
                <span className="mt-2 block text-xs text-fd-muted-foreground">
                  Widget supplied by the Notes plugin
                </span>
              </>
            ) : (
              <span className="mt-2 block">
                Your slot is here. No widget yet — choose step 3 to add one.
              </span>
            )}
          </button>
        )}
      </div>
      <Explanation
        id={details}
        region={{ ...step, slot: 'counter.footer', accepts: 'component' }}
        file={step.file}
        code={step.code}
      />
    </Frame>
  );
}
