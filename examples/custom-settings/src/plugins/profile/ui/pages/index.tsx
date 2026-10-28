'use client';
import { Action, useBitaKitNavigation, useSetting } from '@bitakit/ui';
import { Button, PageHeader } from '@bitakit/ui/components';
import { ProfileCard } from '../profile-card';

// Served at /profile: reads every setting with useSetting and writes some through an Action.
export default function ProfilePage() {
  const tips = useSetting('profile.tips').value;
  const Link = useBitaKitNavigation().Link ?? 'a';
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profile"
        subtitle="Every value here is a setting, saved on the server."
        trailing={
          <div className="flex flex-wrap gap-2">
            <Action id="profile.pause">
              <Button variant="outline" />
            </Action>
            <Button asChild>
              <Link href="/settings/profile">Edit profile</Link>
            </Button>
          </div>
        }
      />
      <ProfileCard />
      {tips && (
        <p className="text-sm text-muted-foreground">
          Tip: Alt+Shift+P opens the profile settings from anywhere. Turn tips off there; that one
          stays in this browser.
        </p>
      )}
    </div>
  );
}
