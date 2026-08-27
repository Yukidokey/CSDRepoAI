import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecoveryParams } from './authRecovery.js';

test('detects Supabase recovery links from the URL hash', () => {
  const params = parseRecoveryParams('#access_token=abc&refresh_token=xyz&expires_at=123&type=recovery');

  assert.equal(params.isRecovery, true);
  assert.equal(params.type, 'recovery');
  assert.equal(params.accessToken, 'abc');
  assert.equal(params.refreshToken, 'xyz');
  assert.equal(params.expiresAt, '123');
});

test('ignores non-recovery URL fragments', () => {
  const params = parseRecoveryParams('#error=access_denied');

  assert.equal(params.isRecovery, false);
  assert.equal(params.type, null);
  assert.equal(params.accessToken, null);
});
