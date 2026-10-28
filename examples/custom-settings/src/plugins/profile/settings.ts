import { defineSettings, setting } from '@bitakit/core';
import { z } from 'zod';

// One declaration generates the page at /settings/profile with three groups. The server reads
// this same file to check every value it saves (src/app/api/settings/route.ts).
export default defineSettings(
  {
    displayName: setting({
      default: 'Ada Lovelace',
      // A schema: the field shows its message, and the server rejects the same values.
      schema: z.string().trim().min(2, 'Use at least 2 characters.').max(40, 'Keep it under 40.'),
      label: 'Display name',
      group: 'Profile',
    }),
    bio: setting({
      default: '',
      schema: z.string().max(160, 'Keep it under 160 characters.'),
      control: 'textarea',
      label: 'About you',
      description: 'Shown on your profile.',
      group: 'Profile',
    }),
    plan: setting({
      default: 'free',
      control: 'cards',
      options: [
        { value: 'free', label: 'Free', description: 'One project, community support.' },
        { value: 'pro', label: 'Pro', description: 'Unlimited projects, email support.' },
        { value: 'team', label: 'Team', description: 'Shared projects and roles.' },
      ],
      label: 'Plan',
      group: 'Profile',
    }),
    channels: setting({
      // A list default with options: several choices, shown as checkboxes.
      default: ['email'],
      options: [
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'Text message' },
        { value: 'push', label: 'Push notification' },
      ],
      label: 'Notify me by',
      group: 'Notifications',
    }),
    digest: setting({
      default: 'weekly',
      control: 'radio',
      options: [
        { value: 'daily', label: 'Every day' },
        { value: 'weekly', label: 'Every week' },
        { value: 'never', label: 'Never' },
      ],
      label: 'Summary email',
      group: 'Notifications',
    }),
    mutedWords: setting({
      default: ['newsletter'],
      control: 'list',
      label: 'Mute messages that mention',
      group: 'Notifications',
    }),
    tips: setting({
      default: true,
      // Device scope: this browser only. The storage service keeps it out of the server.
      scope: 'device',
      label: 'Show tips on this device',
      group: 'This device',
    }),
  },
  {
    title: 'Profile',
    description: 'Saved on the server in SQLite; the last group stays in this browser.',
    category: 'account',
    shortcut: 'Alt+Shift+P',
  },
);
