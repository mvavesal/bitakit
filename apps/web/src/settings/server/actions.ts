'use server';
import { cookies } from 'next/headers';
import { getDatabase } from '@/lib/db';
import { localeCookie } from '@/i18n/config';
import { settingAccess, defaultSettingValue } from './storage';
import { localeSetting, themeSetting } from '../definitions';
import type { SettingValue, StoredSetting } from '@bitakit/app-preferences/core';
/** Keys anonymous visitors can keep: the theme in browser storage, the locale in a cookie. */
const guestPersisted = new Set<string>([themeSetting.key, localeSetting.key]);
export async function readSetting(
  key: string,
  organizationId?: string,
  expectedUserId?: string,
): Promise<StoredSetting> {
  const { setting, access } = await settingAccess(key, organizationId, expectedUserId);
  if (!access) {
    if (setting.scope !== 'user') throw new Error('Sign in to access settings.');
    // Anonymous preferences remain browser-local; defaults contain no secrets.
    const cookie =
      key === 'language.locale' ? (await cookies()).get(localeCookie)?.value : undefined;
    return {
      value: cookie === 'en' || cookie === 'de' ? cookie : defaultSettingValue(key),
      writable: guestPersisted.has(key),
    };
  }
  const row = await getDatabase().appSetting.findUnique({
    where: { scope_owner_key: { scope: setting.scope, owner: access.owner, key } },
  });
  return {
    value: row ? setting.parse(row.value) : defaultSettingValue(key),
    writable: access.writable,
  };
}
export async function saveSetting(
  key: string,
  input: SettingValue,
  organizationId?: string,
  expectedUserId?: string,
) {
  const { setting, access } = await settingAccess(key, organizationId, expectedUserId);
  const value = setting.parse(input);
  if (!access && setting.scope !== 'user') throw new Error('Sign in to save settings.');
  // Never report success for a guest value that nothing would persist.
  if (!access && !guestPersisted.has(key)) throw new Error('Sign in to save this setting.');
  if (access) {
    if (!access.writable) throw new Error('Setting is read-only.');
    await getDatabase().appSetting.upsert({
      where: { scope_owner_key: { scope: setting.scope, owner: access.owner, key } },
      create: {
        scope: setting.scope,
        owner: access.owner,
        key,
        value,
        userId: access.userId,
        organizationId: access.organizationId,
      },
      update: { value },
    });
  }
  if (key === 'language.locale')
    (await cookies()).set(localeCookie, String(value), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
}
