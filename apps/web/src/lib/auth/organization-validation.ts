import { isOrganizationLogo } from './organization-logo';
import { APIError } from 'better-auth/api';
import { organizationSchema } from '@/lib/organizations/schema';

export async function validateOrganization({
  organization,
}: {
  organization: {
    name?: string;
    slug?: string;
    logo?: string | null;
    metadata?: Record<string, unknown>;
  };
}) {
  const result = organizationSchema.partial().safeParse({
    name: organization.name,
    slug: organization.slug,
    website: organization.metadata?.website,
  });
  if (!result.success || (organization.logo && !(await isOrganizationLogo(organization.logo)))) {
    throw new APIError('BAD_REQUEST', { message: 'Invalid organization details.' });
  }
}
