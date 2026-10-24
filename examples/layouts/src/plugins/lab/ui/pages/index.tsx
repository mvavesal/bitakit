'use client';
import { PageHeader } from '@bitakit/ui/components';

// `full-page`: Shell's page spacing without the navigation frame.
export const layout = 'full-page';

export default function LandingPage() {
  return <PageHeader title="Landing page" subtitle="The full-page family: no navigation frame." />;
}
