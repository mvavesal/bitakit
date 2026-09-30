export type OrganizationDetails = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  website: string;
  role: string;
  memberCount: number;
};

export function organizationMetadata(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
