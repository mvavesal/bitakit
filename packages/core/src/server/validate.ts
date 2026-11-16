import type { InputSchema } from '../definitions.js';
import { isOperationError, type OperationIssue } from '../operation-error.js';
import { isThenable } from '../schema.js';

/**
 * The outcome of one validation:
 * - `ok`: the validator's value;
 * - `issues`: the value is invalid. `cause` is set when a `parse` threw without structured
 *   issues; its message never reaches the caller (the kernel logs it), the issue is a fixed text;
 * - `fault`: the schema itself failed (a Standard Schema `validate` threw or rejected, which is
 *   never how it reports invalid values): a server error.
 * An `OperationError` thrown by `parse` is rethrown as it is, so hand-written parsers can still
 * send a safe message of their own.
 */
export type Checked =
  | { ok: true; value: unknown }
  | { ok: false; issues: OperationIssue[]; cause?: unknown }
  | { ok: false; fault: unknown };
type RawIssue = { message?: unknown; path?: readonly unknown[] };

const segment = (part: unknown): string | number =>
  typeof part === 'number'
    ? part
    : part && typeof part === 'object' && 'key' in part
      ? segment((part as { key: unknown }).key)
      : String(part);
function issuesOf(raw: readonly RawIssue[]): OperationIssue[] {
  return raw.map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.map(segment) : [],
    message: typeof issue.message === 'string' ? issue.message : 'Invalid value.',
  }));
}
/** A `parse` failure: its `issues` (zod, valibot and friends), else a fixed root issue. */
function parseFailure(error: unknown): Checked {
  if (isOperationError(error)) throw error;
  const issues = (error as { issues?: unknown })?.issues;
  if (Array.isArray(issues) && issues.length) return { ok: false, issues: issuesOf(issues) };
  return { ok: false, issues: [{ path: [], message: 'Invalid value.' }], cause: error };
}
const fault = (error: unknown): Checked => ({ ok: false, fault: error });
function settle(result: unknown): Checked {
  const outcome = result as { value?: unknown; issues?: readonly RawIssue[] };
  return outcome && Array.isArray(outcome.issues)
    ? { ok: false, issues: issuesOf(outcome.issues) }
    : { ok: true, value: outcome?.value };
}
const parsed = (value: unknown): Checked => ({ ok: true, value });

/**
 * Validates once and keeps each issue's path. Standard Schema is preferred because its issues
 * are structured and it may be async; `parse` is the fallback and may return a promise too.
 * Returns a promise only when the schema validates asynchronously.
 */
export function check(schema: InputSchema<unknown>, value: unknown): Checked | Promise<Checked> {
  if ('~standard' in schema && typeof schema['~standard']?.validate === 'function') {
    try {
      const result = schema['~standard'].validate(value);
      return isThenable(result) ? Promise.resolve(result).then(settle, fault) : settle(result);
    } catch (error) {
      return fault(error);
    }
  }
  try {
    const result = (schema as { parse(input: unknown): unknown }).parse(value);
    return isThenable(result) ? Promise.resolve(result).then(parsed, parseFailure) : parsed(result);
  } catch (error) {
    return parseFailure(error);
  }
}

/** A value usable as `input`/`output`: `{ parse }` or a Standard Schema. */
export function isSchema(value: unknown): boolean {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return false;
  const candidate = value as { parse?: unknown; '~standard'?: { validate?: unknown } };
  return (
    typeof candidate.parse === 'function' || typeof candidate['~standard']?.validate === 'function'
  );
}
