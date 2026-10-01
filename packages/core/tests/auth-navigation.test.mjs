import test from 'node:test';
import assert from 'node:assert/strict';
import { configureAuthPaths, resolveAuthReturnTo, authSignInHref } from '../dist/core.js';

const paths = { signIn: '/login', afterSignIn: '/dashboard', afterSignOut: '/' };
test('auth paths remain explicit and return targets reject external destinations and login loops', () => {
  assert.ok(Object.isFrozen(configureAuthPaths(paths)));
  assert.equal(resolveAuthReturnTo(paths, '/customers?q=test#details'), '/customers?q=test#details');
  for (const target of [undefined, 'https://evil.test/', '//evil.test', '/a/..//evil.test', '/\\evil.test', '/login?returnTo=/login', '/login/', '/a/../login', 'javascript:alert(1)', '/\n/evil.test']) {
    assert.equal(resolveAuthReturnTo(paths, target), '/dashboard');
  }
  assert.equal(authSignInHref(paths, '/customers?q=test'), '/login?returnTo=%2Fcustomers%3Fq%3Dtest');
  assert.equal(authSignInHref({ ...paths, signIn: '/login?method=sso' }, '/'), '/login?method=sso&returnTo=%2F');
  for (const key of Object.keys(paths)) {
    assert.throws(() => configureAuthPaths({ ...paths, [key]: 'https://evil.test' }), /root-relative/);
  }
  assert.throws(() => configureAuthPaths({ ...paths, afterSignIn: '/login/' }), /differ/);
  assert.throws(() => configureAuthPaths({ ...paths, signIn: '/a/..//evil.test' }), /root-relative/);
});
