import { defineAction, getService } from '@bitakit/core';
import { z } from 'zod';
import { notificationService } from '../services/notifications.js';

export const testNotification = defineAction({
  title: 'Test notification',
  input: z.object({ message: z.string() }),
  execute: ({ services, input }) => {
    getService(services, notificationService).show(input.message, { type: 'info' });
  },
});
