import type { ActionGroup, ActionList } from '@bitakit/core/actions';
import type { Feedback, MessageValues } from '../actions/feedback.js';
import type { ResolvedContribution, Services, Translator } from '../definitions.js';
import type { FoundationApp } from '../app/types.js';

export type FeedbackOutcome = { message: string | false; closeDialog: boolean };
export type Override = Readonly<{ enabled?: boolean; visible?: boolean }> | undefined;
/** Contributions that open the shared dialog host. */
export type OpenableDefinition = Exclude<ResolvedContribution, { kind: 'action' | 'native' }>;
export type DialogState = { definition: OpenableDefinition; input: unknown; token: symbol };

/** Runtime capabilities available to contribution adapters. Registration ownership stays with the runtime. */
export interface ContributionHost {
  readonly app: FoundationApp;
  readonly actions: ActionList;
  readonly services: Services;
  /** A translator bound to the current locale, with `has` always answering. */
  translator(): Translator;
  title(definition: ResolvedContribution): string;
  description(definition: ResolvedContribution): string | undefined;
  text(key: string | undefined, fallback: string, values?: MessageValues): string;
  feedback<C>(
    definition: ResolvedContribution,
    kind: 'success' | 'failure',
    option: Feedback<C>,
    context: C,
  ): FeedbackOutcome;
  /** Presentation only; a failing notifier never changes the business outcome. */
  notify(message: string | false): void;
  getGroup(entry: string | ActionGroup): ActionGroup;
  override(id: string): Override;
  dialog(): DialogState | null;
  openDialog(definition: OpenableDefinition, input: unknown): void;
  rememberFormFeedback(state: DialogState, outcome: FeedbackOutcome): void;
}
