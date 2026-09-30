import type { StandardSchemaV1 } from '@standard-schema/spec';
export type { StandardSchemaV1 } from '@standard-schema/spec';
export type StandardSchemaResult<Output> = StandardSchemaV1.Result<Output>;

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    !!value &&
    typeof value === 'object' &&
    '~standard' in value &&
    typeof (value as StandardSchemaV1)['~standard']?.validate === 'function'
  );
}

/** Settings values are validated synchronously so loading, drafts and writes share one check. */
export function validateSync<Output>(schema: StandardSchemaV1<unknown, Output>, value: unknown) {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise)
    throw new Error(
      'Settings schemas must validate synchronously; async validators are not supported.',
    );
  return result;
}
