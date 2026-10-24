'use client';
import { useServiceState } from '@bitakit/ui';

// Fills the `notes.footer` slot that the notes plugin renders below its list.
export default function ActivityFeed() {
  const entries = useServiceState('activity.feed', (state) => state.entries, []);
  if (!entries.length) return null;
  return (
    <section aria-label="Recent activity" className="text-sm text-muted-foreground">
      <h2 className="font-medium text-foreground">Recent activity</h2>
      <ul>
        {entries.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </section>
  );
}
