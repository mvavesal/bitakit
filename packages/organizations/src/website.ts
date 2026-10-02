import { parse } from 'tldts';
import { z } from 'zod';

export const organizationWebsiteError =
  'Invalid URL.';

/** Standard URL syntax plus the product's public-domain policy; no reachability check. */
export const organizationWebsiteSchema = z.string().trim().pipe(
  z.union([
    z.literal(''),
    z.url({ protocol: /^https?$/, error: organizationWebsiteError }).pipe(z.string()
      .max(2048, organizationWebsiteError)
      .refine(value => /^https?:\/\/[^/?#]/i.test(value) && !/[\s\\]/u.test(value), organizationWebsiteError)
      .refine(value => {
        const url = new URL(value);
        if (url.username || url.password) return false;
        const domain = parse(url.hostname, { validateHostname: true });
        return url.hostname === 'localhost' || !!domain.isIp || (!!domain.isIcann && !!domain.domain);
      }, organizationWebsiteError)),
  ], { error: organizationWebsiteError }),
);

export function isOrganizationWebsite(value: string): boolean {
  return organizationWebsiteSchema.safeParse(value).success;
}
