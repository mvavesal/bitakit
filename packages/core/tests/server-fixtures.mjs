// Shared helpers for the server-*.test.mjs files (not a test file itself).
import { createServer, definePlugin, defineAction } from '../dist/server/index.js';

/** Identities a test provider answers, selected by the `x-who` header. */
export const people = {
  anonymous: { user: null },
  member: {
    user: { id: 'u1', name: 'Mia' },
    organization: { id: 'o1' },
    member: { id: 'm1', role: 'member' },
    can: (permission) => Object.keys(permission).every((resource) => resource === 'todos'),
  },
  other: {
    user: { id: 'u2' },
    organization: { id: 'o2' },
    member: { id: 'm2', role: 'member' },
    can: () => false,
  },
  lonely: { user: { id: 'u3' }, organization: null, reason: 'NO_ACTIVE_ORGANIZATION' },
  outsider: { user: { id: 'u4' }, organization: null, reason: 'NOT_A_MEMBER' },
};

/** A `requestContext` provider for host services: `who` names an entry of `table`. */
export function provider(table = people) {
  return {
    resolve: (request) => table[request.headers.get('x-who') ?? 'anonymous'] ?? { user: null },
  };
}
export const as = (name, headers = {}) => new Headers({ 'x-who': name, ...headers });

/** A server over one plugin's actions, with the test provider unless `services` says otherwise. */
export function serverOf(actions, { services = { requestContext: provider() }, ...rest } = {}) {
  return createServer(
    { plugins: [definePlugin({ id: 'todos', actions, ...rest.plugin })], ...rest.config },
    { services, ...rest.options },
  );
}

export const ok = (value) => defineAction({ access: 'public', expose: true, execute: () => value });

/** Resolves with the OperationError's JSON form, or fails when the promise resolves. */
export async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected a rejection.');
}

/** Captures console output of one kind while `run` executes. */
export async function quiet(kind, run) {
  const original = console[kind];
  const lines = [];
  console[kind] = (...args) => lines.push(args);
  try {
    await run(lines);
  } finally {
    console[kind] = original;
  }
  return lines;
}
