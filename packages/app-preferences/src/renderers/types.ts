import type { ComponentType, ReactNode } from 'react';
import type { Setting } from '../fields/setting.js';
import type { MultiSelectSetting } from '../fields/multi-select-setting.js';
import type { SelectSetting } from '../fields/select-setting.js';
import type { SettingsSection } from '../catalog/section.js';
import type {
  SaveResult,
  SettingPresentation,
  SettingState,
  SettingType,
  SettingValue,
} from '../types.js';
import type { SettingsMessages } from '../react/messages.js';

export type ValueOf<S> = S extends Setting<infer T> ? T : never;
export type ResolvedOption<V extends string = string> = Readonly<{
  value: V;
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}>;
type BaseControlProps<S extends Setting<any>> = {
  setting: S;
  /** The value to display: the latest requested value while a write is pending, otherwise the confirmed value. */
  value: ValueOf<S>;
  /** The value AppPreferences has confirmed. */
  confirmedValue: ValueOf<S>;
  /** Validates, queues and saves. Resolves with the save outcome; rejects when this write fails. */
  setValue(value: ValueOf<S>): Promise<SaveResult>;
  reset(): Promise<SaveResult>;
  ready: boolean;
  writable: boolean;
  /** Not loaded, not writable or inside a disabled section. Pending writes do not disable controls. */
  disabled: boolean;
  pending: boolean;
  error?: string;
  /** Resolved, translated texts. */
  label: string;
  description?: string;
  presentation: SettingPresentation;
  /** Associations with the label, description and feedback rendered by the field view. */
  id: string;
  labelId: string;
  descriptionId?: string;
  feedbackId: string;
  describedBy?: string;
  messages: SettingsMessages;
};
/** Props for a control, typed from its field reference. */
export type SettingControlProps<S extends Setting<any> = Setting<any>> = BaseControlProps<S> &
  (S extends SelectSetting<infer V> | MultiSelectSetting<infer V>
    ? { options: readonly ResolvedOption<V>[] }
    : {});
type SettingForType = {
  boolean: Setting<boolean>;
  choice: SelectSetting<string>;
  'multi-choice': MultiSelectSetting<string>;
  text: Setting<string>;
  number: Setting<number>;
};
export type TypeControlProps<K extends SettingType> = SettingControlProps<SettingForType[K]>;

/** Pre-bound parts of one field; the ids already connect label, description, control and feedback. */
export type SettingsSectionItem = Readonly<{
  key: string;
  setting: Setting<any>;
  /** Undefined when the definition is not registered; `content` then shows a configuration alert. */
  state?: SettingState<SettingValue>;
  label: ReactNode;
  description: ReactNode;
  control: ReactNode;
  feedback: ReactNode;
  /** Standard individual reset control, bound to this field's persistence and feedback. */
  resetControl: ReactNode;
  /** The complete default field. */
  content: ReactNode;
  labelText: string;
  descriptionText?: string;
  /** True when the control is a group labelled through aria-labelledby. */
  group: boolean;
  /**
   * Ids already wired into the control. A custom layout may render its own title element with
   * `labelId` (and `descriptionId`) instead of `label`/`description` without losing associations.
   */
  ids: Readonly<{ controlId: string; labelId: string; descriptionId?: string; feedbackId: string }>;
}>;
export type SettingsSectionRendererProps = Readonly<{
  section: SettingsSection;
  title: string;
  description?: string;
  items: readonly SettingsSectionItem[];
  /** The default rendering of all items, for layouts that only add surrounding content. */
  content: ReactNode;
  disabled: boolean;
}>;
export type SettingsFieldViewProps = Readonly<{ item: SettingsSectionItem }>;
export type SettingsViewProps = Readonly<{
  sections: readonly SettingsSection[];
  selected?: SettingsSection;
  select(id: string): void;
  renderSection(section: SettingsSection): ReactNode;
  /** Resolves a section title or description with the active translator. */
  text(section: SettingsSection, part: 'title' | 'description'): string | undefined;
}>;
export type SettingsViewPropsMap = {
  settings: SettingsViewProps;
  section: SettingsSectionRendererProps;
  field: SettingsFieldViewProps;
};
export type SettingsComponent<P> = ComponentType<P>;
