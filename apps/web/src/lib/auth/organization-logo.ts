import sharp from 'sharp';

/** Native Better Auth UI falls back to a data URL when no upload service is supplied. */
export async function isOrganizationLogo(value: string): Promise<boolean> {
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return Boolean(url.hostname);
    } catch {
      return false;
    }
  }
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil((2 * 1024 * 1024) / 3) * 4) return false;
  try {
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.toString('base64') !== match[2]) return false;
    const metadata = await sharp(bytes, { limitInputPixels: 4096 * 4096 }).metadata();
    return (
      metadata.format === match[1] &&
      Boolean(metadata.width && metadata.height) &&
      metadata.width! <= 4096 &&
      metadata.height! <= 4096
    );
  } catch {
    return false;
  }
}
