// The one domain check of invitation policies, shared by screens and providers (browser and server). It uses the WHATWG
// URL parser, whose host parsing applies IDNA (UTS #46): Unicode names become their ASCII form, case is folded.

/**
 * A domain in its stored form (ASCII, lowercase, no trailing dot), or `null` when it is not a domain an invitation
 * policy can list: invalid names, wildcards (use „include subdomains“), addresses, IP addresses and single labels.
 */
export function normalizeInvitationDomain(value: string): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /[\s*@/:\\[\]?#%]/.test(trimmed)) return null;
  let host: string;
  try {
    host = new URL(`http://${trimmed}`).hostname;
  } catch {
    return null;
  }
  const ascii = host.toLowerCase().replace(/\.$/, '');
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split('.');
  if (labels.length < 2 || labels.some((label) => !label || label.length > 63)) return null;
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  if (/^\d+$/.test(labels.at(-1)!)) return null; // an IPv4 address, not a domain
  return ascii;
}
