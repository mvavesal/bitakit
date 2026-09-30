'use client';
import { useEffect, useState, type ElementType } from 'react';
import type { Setting } from '../fields/setting.js';
import { useSetting } from '../react/use-setting.js';
/** Text/number drafts commit on blur, not on every keystroke. */
/** Keeps a local text or number edit draft and saves on blur; confirmed state remains in AppPreferences. */
export function SettingInput({
  setting,
  as: Component = 'input',
}: {
  setting: Setting<string> | Setting<number>;
  as?: ElementType;
}) {
  const binding = useSetting<any>(setting);
  const [draft, setDraft] = useState(String(binding.value));
  useEffect(() => setDraft(String(binding.value)), [binding.value]);
  if (!binding.visible) return null;
  return (
    <label>
      {setting.title}
      <Component
        type={setting.kind === 'number' ? 'number' : 'text'}
        value={draft}
        disabled={binding.disabled}
        onChange={(event: { target: { value: string } }) => setDraft(event.target.value)}
        onBlur={() => {
          void binding
            .setValue(setting.kind === 'number' && draft.trim() ? Number(draft) : draft)
            .catch(() => {});
        }}
      />
      {binding.error && <span role="alert">{binding.error}</span>}
    </label>
  );
}
