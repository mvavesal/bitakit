import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createServer, defineAction, definePlugin } from '../dist/server/index.js';

// What transport adapters build on (2026-11-18): every operation says whether it only reads and,
// where its schema can say so (Standard JSON Schema, e.g. zod 4), what goes in and comes out.
test('operations() describe type and the JSON Schemas of input and output', async () => {
  const list = defineAction({
    access: 'public',
    expose: true,
    type: 'query',
    input: z.object({ page: z.number().int().min(1) }),
    output: z.object({ items: z.array(z.string()) }),
    execute: () => ({ items: ['a'] }),
  });
  const rename = defineAction({
    access: 'public',
    expose: true,
    input: { parse: (value) => value },
    execute: () => undefined,
  });
  const server = createServer({
    plugins: [definePlugin({ id: 'notes', actions: { list, rename } })],
  });
  try {
    const [first, second] = await server.operations();
    assert.equal(first.type, 'query');
    assert.deepEqual(first.input, {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { page: { type: 'integer', minimum: 1, maximum: 9007199254740991 } },
      required: ['page'],
    });
    assert.equal(first.output.properties.items.type, 'array');
    assert.ok(Object.isFrozen(first.input));
    assert.equal(second.type, 'mutation', 'mutation is the default');
    assert.equal(second.input, undefined, 'a schema without JSON Schema is described as any');
    assert.equal(second.output, undefined);
  } finally {
    await server.stop();
  }
});

test('a type other than query or mutation stops the boot', async () => {
  const odd = defineAction({ access: 'public', type: 'subscription', execute: () => undefined });
  const server = createServer({ plugins: [definePlugin({ id: 'notes', actions: { odd } })] });
  // The startup error is logged once; keep the test output clean.
  const error = console.error;
  console.error = () => undefined;
  try {
    await assert.rejects(server.operations());
  } finally {
    console.error = error;
  }
  await server.stop().catch(() => undefined);
});
