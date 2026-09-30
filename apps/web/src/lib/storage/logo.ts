import 'server-only';
import sharp from 'sharp';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function prepareLogo(file: File) {
  if (
    file.size > MAX_LOGO_BYTES ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  ) {
    throw new Error('Invalid logo.');
  }
  const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000 });
  const metadata = await image.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) {
    throw new Error('Invalid logo.');
  }
  return image
    .rotate()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}
