import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldFallbackDeleteError } from './users.js';

test('detects RLS and permission errors as fallback-worthy delete failures', () => {
  assert.equal(shouldFallbackDeleteError({ message: 'new row violates row-level security policy' }), true);
  assert.equal(shouldFallbackDeleteError({ message: 'permission denied for table profiles' }), true);
  assert.equal(shouldFallbackDeleteError({ message: 'Database error' }), false);
});
