import { SettingsSection, type SectionOptions } from './section.js';
import type { Registration } from '../types.js';
/** One observable catalog for sections and plugin pages. */
export class SettingsCatalog {
  private entries = new Map<string, { section: SettingsSection; parent?: string; owner: symbol }>();
  private snapshot: readonly SettingsSection[] = [];
  private listeners = new Set<() => void>();
  getSections = () => this.snapshot;
  subscribeSections = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSection(id: string) {
    return this.entries.get(id)?.section;
  }
  add(section: SettingsSection, options?: { section: string }): Registration {
    if ([...this.entries.values()].some((entry) => entry.section.path === section.path))
      throw new Error('Duplicate section path.');
    if (this.entries.has(section.id)) throw new Error(`Duplicate settings section: ${section.id}`);
    if (options && !this.entries.has(options.section))
      throw new Error('Target section does not exist.');
    const owner = Symbol();
    this.entries.set(section.id, { section, parent: options?.section, owner });
    this.publish();
    return {
      remove: () => {
        if (this.entries.get(section.id)?.owner !== owner) return;
        this.entries.delete(section.id);
        this.publish();
      },
    };
  }
  updateSection(id: string, patch: Partial<Omit<SectionOptions, 'id'>>) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error('Unknown settings section.');
    const next = new SettingsSection({ ...entry.section, ...patch });
    if (
      [...this.entries.values()].some(
        (other) => other !== entry && other.section.path === next.path,
      )
    )
      throw new Error('Duplicate section path.');
    entry.section = next;
    this.publish();
  }
  private publish() {
    this.snapshot = [...this.entries.values()]
      .filter((e) => !e.parent || this.entries.has(e.parent))
      .map((e) => {
        if (!e.parent) return e.section;
        const parent = this.entries.get(e.parent)!.section;
        return new SettingsSection({
          ...e.section,
          category: parent.category ?? { id: parent.id, title: parent.title },
          visible: parent.visible && e.section.visible,
          enabled: parent.enabled && e.section.enabled,
        });
      });
    for (const listener of this.listeners) listener();
  }
}
