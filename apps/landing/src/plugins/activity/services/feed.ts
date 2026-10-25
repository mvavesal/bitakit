import { defineService } from '@bitakit/core';
import sampleWeeks from '../data/heatmap.json';

export type Entry = { kind: 'added' | 'won' | 'removed'; name: string };

// Monday first, so the weekday rows read Mon to Sun.
const today = () => (new Date().getDay() + 6) % 7;

// Listens to the pipeline without changing it; the listeners end when this plugin stops.
// Every event also counts towards today's cell of the heatmap (sample history in data/).
export default defineService(({ store, events }) => {
  const state = store<{ entries: Entry[]; weeks: number[][] }>({
    entries: [],
    weeks: sampleWeeks,
  });
  const push = (entry: Entry) =>
    state.set((current) => ({
      entries: [entry, ...current.entries].slice(0, 6),
      weeks: current.weeks.map((week, index) =>
        index === current.weeks.length - 1
          ? week.map((count, day) => (day === today() ? count + 1 : count))
          : week,
      ),
    }));
  events.on('pipeline.added', ({ data }) => push({ kind: 'added', name: data.name }));
  events.on('pipeline.won', ({ data }) => push({ kind: 'won', name: data.name }));
  events.on('pipeline.removed', ({ data }) => push({ kind: 'removed', name: data.name }));
  return { state };
});
