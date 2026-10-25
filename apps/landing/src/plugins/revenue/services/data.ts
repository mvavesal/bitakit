import { defineService } from '@bitakit/core';
import sampleWeeks from '../data/weeks.json';
import sampleDays from '../data/days.json';

export type Week = { date: string; newBusiness: number; renewals: number };

// Varies the sample a little, so a refresh visibly changes the charts.
const vary = (value: number) => Math.round(value * (0.85 + Math.random() * 0.3));

// Sample revenue from data/. A real app would fetch it here; nothing else changes.
export default defineService(({ store }) => {
  const state = store<{ weeks: Week[]; days: number[] }>({ weeks: sampleWeeks, days: sampleDays });
  return {
    state,
    async refresh() {
      await new Promise((resolve) => setTimeout(resolve, 600));
      state.set({
        weeks: sampleWeeks.map((week) => ({
          ...week,
          newBusiness: vary(week.newBusiness),
          renewals: vary(week.renewals),
        })),
        days: sampleDays.map(vary),
      });
    },
  };
});
