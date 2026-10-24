'use client';
import { ErrorPage } from '@bitakit/shell/pages';

// Errors in app pages, inside the app frame. A screen.error contribution replaces this page.
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorPage reset={retry} />;
}
