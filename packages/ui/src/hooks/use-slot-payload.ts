'use client';
import { useEffect, useRef, useState } from 'react';
import { validate, type InputSchema } from '@bitakit/core';
import { shallowEqual } from '../utils/merge-props.js';

/** Validation belongs to this outlet occurrence, never to the shared attachment. */
export function useSlotPayload(schema: InputSchema<any> | undefined, payload: unknown) {
  const stable = useRef(payload);
  // Only containers with ordinary enumerable fields use shallow stabilization.
  const plain = (value: unknown) =>
    !!value &&
    typeof value === 'object' &&
    (Array.isArray(value) ||
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
  const same =
    Object.is(stable.current, payload) ||
    (plain(stable.current) && plain(payload) && shallowEqual(stable.current, payload));
  if (!same) stable.current = payload;
  const source = stable.current;
  const [result, setResult] = useState<{
    schema: InputSchema<any>;
    source: unknown;
    value?: unknown;
    error?: Error;
  }>();
  useEffect(() => {
    if (!schema) return;
    let active = true;
    void validate(schema, source).then(
      (value) => {
        if (active) setResult({ schema, source, value });
      },
      (cause) => {
        if (active)
          setResult({
            schema,
            source,
            error: cause instanceof Error ? cause : new Error(String(cause)),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [schema, source]);
  if (!schema) return { pending: false, value: payload, error: undefined };
  if (result?.schema !== schema || !Object.is(result.source, source))
    return { pending: true, value: undefined, error: undefined };
  return { pending: false, value: result.value, error: result.error };
}
