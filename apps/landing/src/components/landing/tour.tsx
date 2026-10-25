'use client';
import { useId } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { topics, type Topic } from '@/components/playground/topics';

/** Radix owns both responsive controls; they share the parent's topic and inspector state. */
export function TopicTabs({
  active,
  expanded,
  onChange,
}: {
  active: Topic['id'];
  expanded: boolean;
  onChange(id: Topic['id']): void;
}) {
  const indicatorGroup = useId();
  const reduced = useReducedMotion();
  return (
    <LayoutGroup id={indicatorGroup}>
      <div className="playground-topic-select">
        {/* Clearing the selection when closed lets the current topic reopen the inspector. */}
        <Select value={expanded ? active : ''} onValueChange={(id) => onChange(id as Topic['id'])}>
          <SelectTrigger aria-label="Explore the live app" className="w-full">
            <SelectValue placeholder={topics.find((topic) => topic.id === active)?.label} />
          </SelectTrigger>
          <SelectContent className="site-theme playground-topic-options" position="popper">
            <SelectGroup>
              {topics.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Tabs
        value={active}
        onValueChange={(id) => onChange(id as Topic['id'])}
        className="playground-topic-tabs max-w-full min-w-0"
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
