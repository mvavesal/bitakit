'use client';
import { useEffect, useState } from 'react';
import { detectPlatform, formatForDisplay, validateHotkey, type Hotkey } from '@tanstack/hotkeys';

/** Library-formatted labels after hydration; rendering never registers a keyboard handler. */
export function ActionShortcutLabel({ keys }: { keys: string }) {
  const [platform, setPlatform] = useState<ReturnType<typeof detectPlatform>>();
  useEffect(() => setPlatform(detectPlatform()), []);
  if (!platform || !validateHotkey(keys).valid) return null;
  return formatForDisplay(keys as Hotkey, { platform });
}
