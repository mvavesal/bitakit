import { organizationWebsiteSchema } from '@bitakit/organizations';
import { z } from 'zod';

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .regex(/^https?:\/\//i)
  .pipe(
    z.url({ protocol: /^https?$/ }).refine((value) => {
      const url = new URL(value);
      return !url.username && !url.password;
    }),
  );

export const organizationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  website: organizationWebsiteSchema,
});

export type OrganizationInput = z.input<typeof organizationSchema>;
