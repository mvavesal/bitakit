import { parse } from 'yaml';
import { z } from 'zod';
import type { Schedule, ScheduleSource } from './types.js';

const common = {
  id: z.string().min(1),
  task: z.string().min(1),
  input: z.json().optional(),
  timezone: z.string().optional(),
  paused: z.boolean().optional(),
};
/** External sources contain data only; Croner validates cron/date/timezone semantics. */
export const scheduleSchema = z.union([
  z.strictObject({ ...common, cron: z.string().min(1) }),
  z.strictObject({ ...common, at: z.iso.datetime({ offset: true }) }),
]);
export function parseSchedules(data: unknown): Schedule[] {
  return z.array(scheduleSchema).parse(data);
}
export function parseScheduleDocument(text: string, format: 'json' | 'yaml'): Schedule[] {
  return parseSchedules(format === 'yaml' ? parse(text) : JSON.parse(text));
}
/** A callback may read a DB or CMS using its ordinary server-side authorization. */
export function dataSource(source: ScheduleSource): ScheduleSource {
  return source;
}
/** Fetches a complete data snapshot on registration, explicit reload or subscribed changes. */
export function urlSource(options: {
  id: string;
  url: string | URL;
  priority?: number;
  format?: 'json' | 'yaml';
  fetch?: typeof globalThis.fetch;
  subscribe?: ScheduleSource['subscribe'];
}): ScheduleSource {
  return {
    id: options.id,
    priority: options.priority,
    subscribe: options.subscribe,
    async load() {
      const response = await (options.fetch ?? globalThis.fetch)(options.url, {
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(`Schedule source "${options.id}" returned HTTP ${response.status}.`);
      return parseScheduleDocument(await response.text(), options.format ?? 'json');
    },
  };
}
