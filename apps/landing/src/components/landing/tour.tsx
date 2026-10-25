'use client';
import { useId } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { topics, type Topic } from '@/components/playground/topics';

/** Radix owns selection and keyboard behavior; Motion shares one active surface between tabs. */
export function TopicTabs({
  active,
  onChange,
}: {
  active: Topic['id'];
  onChange(id: Topic['id']): void;
}) {
  const indicatorGroup = useId();
  const reduced = useReducedMotion();
  return (
    <LayoutGroup id={indicatorGroup}>
      <Tabs
        value={active}
        onValueChange={(id) => onChange(id as Topic['id'])}
        className="max-w-full min-w-0"
      >
        <TabsList aria-label="Explore the live app" className="max-w-full">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <TabsTrigger
                key={topic.id}
                id={`playground-tab-${topic.id}`}
                value={topic.id}
                aria-controls="playground-inspector"
                onClick={() => {
                  if (active === topic.id) onChange(topic.id);
                }}
              >
                {active === topic.id && (
                  <motion.span
                    aria-hidden="true"
                    layoutId="active-topic"
                    className="playground-tab-indicator"
                    transition={
                      reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }
                    }
                  />
                )}
                <Icon aria-hidden="true" className="relative" />
                <span className="relative">{topic.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </LayoutGroup>
  );
}
