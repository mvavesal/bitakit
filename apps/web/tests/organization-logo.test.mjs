import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { isOrganizationLogo } from '../src/lib/auth/organization-logo.ts';
test('organization logo supports native raster upload without accepting arbitrary data URLs', async () => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } })
    .png()
    .toBuffer();
  assert.equal(await isOrganizationLogo('data:image/png;base64,' + bytes.toString('base64')), true);
  assert.equal(await isOrganizationLogo('https://example.com/logo.png'), true);
  for (const value of [
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,aGVsbG8=',
    'data:image/jpeg;base64,' + bytes.toString('base64'),
    'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024),
  ]) {
    assert.equal(await isOrganizationLogo(value), false);
  }
});
