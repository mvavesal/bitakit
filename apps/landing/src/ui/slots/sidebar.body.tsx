'use client';
import { useTranslation } from '@bitakit/ui';
import { AppShell } from '@bitakit/shell';

// Renders the `features` group below Shell's main navigation.
export default function FeaturesNavigation() {
  const t = useTranslation();
  return (
    <AppShell.NavigationGroup
      id="features"
      title={t('app.navigation.features', undefined, 'Features')}
      navigationSlot="features"
    />
  );
}
