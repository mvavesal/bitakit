import { AppShell } from '@bitakit/shell';
import { NotFoundPage } from '@bitakit/shell/pages';

// notFound() outside app pages. The error layout and screen.not-found can be replaced.
export default function NotFound() {
  return (
    <AppShell layout="error">
      <NotFoundPage />
    </AppShell>
  );
}
