import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/')({
  component: () => (
    <main className="p-6">
      <h1>Welcome</h1>
    </main>
  ),
});
