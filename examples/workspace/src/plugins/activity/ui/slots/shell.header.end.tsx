'use client';
import { useServiceState } from '@bitakit/ui';

// A widget in Shell's header that reads another plugin's service; 0 until notes is ready.
export default function NoteCount() {
  const count = useServiceState('notes.list', (state) => state.notes.length, 0);
  return <span className="text-sm text-muted-foreground">{count} notes</span>;
}
