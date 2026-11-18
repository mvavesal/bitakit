import { defineSchedule } from '@bitakit/scheduler';

export default defineSchedule({
  task: 'reports.weekly',
  cron: '0 9 * * MON',
  timezone: 'Europe/Berlin',
  input: { audience: 'team' },
});
