'use client';
import { ActionLink } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

export default function SettingsNavigation() {
  return (
    <Button asChild variant="ghost" className="w-full justify-start">
      <ActionLink action="app-preferences.settings" />
    </Button>
  );
}
