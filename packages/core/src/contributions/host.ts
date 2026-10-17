import type { ActionGroup, ActionList } from '@bitakit/core/actions';
import type { Feedback, MessageValues } from '../actions/feedback.js';
import type { ResolvedContribution, Services, Translator } from '../definitions.js';
import type { BitaKitApp } from '../app/types.js';
import type { Confirmation } from '../confirmation.js';

export type FeedbackOutcome = { message: string | false; closeDialog: boolean };
export type Override = Readonly<{ enabled?: boolean; visible?: boolean }> | undefined;
/** An action with a `dialog` component; executing it opens the shared dialog host. */
export type OpenableDefinition = ResolvedContribution & {
  dialog: NonNullable<ResolvedContribution['dialog']>;
};
export type DialogState = { definition: OpenableDefinition; input: unknown; token: symbol };

/** Runtime capabilities available to the action adapter. Registration ownership stays with the runtime. */
export interface ContributionHost {
  readonly app: BitaKitApp;
  readonly actions: ActionList;
  readonly services: Services;
  translator(): Translator;
  title(definition: ResolvedContribution): string;
  description(definition: ResolvedContribution): string | undefined;
  tooltip(definition: ResolvedContribution): string | undefined;
  text(key: string | undefined, fallback: string, values?: MessageValues): string;
  feedback<C>(
    definition: ResolvedContribution,
    kind: 'success' | 'failure',
    option: Feedback<C> | undefined,
    context: C & { error?: unknown },
  ): FeedbackOutcome;
  /** Presentation only; a failing notifier never changes the business outcome. */
  notify(message: string | false, kind?: 'success' | 'failure'): void;
  getGroup(entry: string | ActionGroup): ActionGroup;
  override(id: string): Override;
  dialog(): DialogState | null;
  openDialog(definition: OpenableDefinition, input: unknown): void;
  confirm(request: Confirmation): Promise<boolean>;
}
