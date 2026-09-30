/** A typed extension point. The same group can be rendered in different places. */
export class ActionGroup<Input = unknown> {
  declare readonly inputType: Input;
  constructor(
    public readonly id: string,
    public readonly title?: string,
  ) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(id)) throw new Error('Invalid action group ID.');
    Object.freeze(this);
  }
}
export type RegistrationOptions = {
  groups?: readonly ActionGroup<any>[];
  order?: number;
  dividerBefore?: boolean;
};
export function freezeGroups(groups: readonly ActionGroup<any>[] = []) {
  const ids = new Set<string>();
  for (const group of groups) {
    if (!(group instanceof ActionGroup) || ids.has(group.id))
      throw new Error('Invalid or duplicate action group.');
    ids.add(group.id);
  }
  return Object.freeze([...groups]);
}
