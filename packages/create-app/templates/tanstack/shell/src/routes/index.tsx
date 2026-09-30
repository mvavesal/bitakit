import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@bitakit/shell';
export const Route = createFileRoute('/')({
  component: () => (
    <AppShell>
      <h1>Welcome</h1>
    </AppShell>
  ),
});
