'use client';
import { useSetting } from '@bitakit/ui';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@bitakit/ui/components';

const plans = { free: 'Free', pro: 'Pro', team: 'Team' } as const;

/** The profile as the settings describe it. Used on /profile and as the settings page preview. */
export function ProfileCard() {
  const name = useSetting('profile.displayName').value;
  const bio = useSetting('profile.bio').value;
  const plan = useSetting('profile.plan').value;
  const channels = useSetting('profile.channels').value;
  const digest = useSetting('profile.digest').value;
  const muted = useSetting('profile.mutedWords').value;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-label="Display name">{name}</span>
          <Badge variant="secondary">{plans[plan]}</Badge>
        </CardTitle>
        <CardDescription>{bio || 'No bio yet.'}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <p aria-label="Notifications">
          {channels.length ? `Notifies by ${channels.join(', ')}` : 'Notifications paused'} ·
          summary {digest}
        </p>
        <p className="text-muted-foreground">
          {muted.length ? `Muted: ${muted.join(', ')}` : 'Nothing muted'}
        </p>
      </CardContent>
    </Card>
  );
}
