'use client';
import type { SettingsSection } from '../catalog/section.js';
import { SelectSetting } from '../fields/select-setting.js';
import { ToggleSetting } from '../fields/toggle-setting.js';
import { TextSetting } from '../fields/text-setting.js';
import { NumberSetting } from '../fields/number-setting.js';
import { useSettingsSections } from '../react/use-setting.js';
import { SettingSelect } from './setting-select.js';
import { SettingToggle } from './setting-toggle.js';
import { SettingInput } from './setting-input.js';
/** Renders a custom section component or its declared groups using the default setting controls. */
export function SettingsSectionContent({ section }: { section: SettingsSection }) {
  if (!section.visible) return null;
  const Custom = section.component;
  return (
    <fieldset disabled={!section.enabled} style={{ minInlineSize: 0 }}>
      {Custom ? (
        <Custom />
      ) : (
        section.groups.map((group, index) => (
          <fieldset key={index}>
            <legend>{group.title}</legend>
            {group.items.map((item) =>
              item instanceof SelectSetting ? (
                <SettingSelect key={item.key} setting={item} />
              ) : item instanceof ToggleSetting ? (
                <SettingToggle key={item.key} setting={item} />
              ) : item instanceof TextSetting || item instanceof NumberSetting ? (
                <SettingInput key={item.key} setting={item} />
              ) : null,
            )}
          </fieldset>
        ))
      )}
    </fieldset>
  );
}
/** Renders visible catalog sections with a minimal HTML layout; host applications may supply their own layout. */
export function SettingsPanel() {
  const sections = useSettingsSections();
  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <section key={section.id} aria-label={section.title}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <SettingsSectionContent section={section} />
          </section>
        ))}
    </>
  );
}
