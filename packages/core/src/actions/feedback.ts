import { brand, isBrandedInstance } from './brand.js';
export type MessageValues = Record<string, string | number | Date>;
export type FeedbackMessage = {
  message?: string;
  messageKey?: string;
  values?: MessageValues;
  closeDialog?: boolean;
};
export type FeedbackResult = FeedbackMessage | string | false | undefined;
/** A literal message, a message key, `false` for silence, or a callback returning one of these. */
export type Feedback<Context> = FeedbackResult | ((context: Context) => FeedbackResult);

/** Feedback callbacks cannot turn a successful operation into a failed operation. */
export function evaluateFeedback<C>(feedback: Feedback<C>, context: C): FeedbackMessage | false {
  try {
    const result = typeof feedback === 'function' ? feedback(context) : feedback;
    if (result === false) return false;
    return typeof result === 'string' ? { message: result } : (result ?? {});
  } catch {
    return {};
  }
}

/** Carries only the selected display message; the original error remains in cause. */
export class ActionFailure extends Error {
  static {
    brand(this, 'failure');
  }
  constructor(
    readonly feedback: string | false,
    cause: unknown,
  ) {
    super(feedback || 'Action failed.', { cause });
    this.name = 'ActionFailure';
  }
}

/** Recognizes failures from any copy of this package (see brand.ts). */
export function isActionFailure(error: unknown): error is ActionFailure {
  return isBrandedInstance(error, ActionFailure, 'failure');
}
