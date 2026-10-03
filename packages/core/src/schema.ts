import type { InputSchema } from './definitions.js';

export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value && typeof (value as PromiseLike<unknown>).then === 'function';
const invalid = (issues: readonly { message: string }[]) =>
  new Error(`Invalid input: ${issues.map((issue) => issue.message).join('; ')}`);
/** A readable message for schema errors; zod's message is JSON, but its `issues` are not. */
export function schemaErrorMessage(error: unknown, fallback = 'Invalid input.'): string {
  const issues = (error as { issues?: unknown })?.issues;
  if (Array.isArray(issues) && issues.every((issue) => typeof issue?.message === 'string'))
    return (issues as { message: string }[]).map((issue) => issue.message).join('; ');
  return error instanceof Error && error.message ? error.message : fallback;
}
/** Undefined when the schema validates asynchronously; callers then await `validate`. */
export function validateSync<T>(
  schema: InputSchema<T> | undefined,
  input: unknown,
): { ok: true; value: T } | { ok: false; error: Error } | undefined {
  if (!schema) return undefined;
  try {
    if ('parse' in schema) return { ok: true, value: schema.parse(input) };
    const result = schema['~standard'].validate(input);
    if (isThenable(result)) return undefined;
    if ('issues' in (result as object))
      return {
        ok: false,
        error: invalid((result as { issues: readonly { message: string }[] }).issues),
      };
    return { ok: true, value: (result as { value: T }).value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
export async function validate<T>(schema: InputSchema<T>, input: unknown): Promise<T> {
  if ('parse' in schema) return schema.parse(input);
  const result = await schema['~standard'].validate(input);
  if ('issues' in result) throw invalid(result.issues);
  return result.value;
}
