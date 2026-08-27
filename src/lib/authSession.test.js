import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAuthenticatedSession } from './authSession.js';

test('applyAuthenticatedSession stores the authenticated user and role', () => {
  let sessionState = null;
  let profileState = null;

  const session = { access_token: 'abc123' };
  const user = {
    id: 'user-1',
    email: 'admin@csdrepoai.com',
    user_metadata: {
      full_name: 'Admin User',
      role: 'admin',
    },
  };

  const result = applyAuthenticatedSession({
    session,
    user,
    setSession: (value) => {
      sessionState = value;
    },
    setProfile: (value) => {
      profileState = value;
    },
  });

  assert.equal(sessionState, session);
  assert.equal(profileState.email, 'admin@csdrepoai.com');
  assert.equal(profileState.role, 'admin');
  assert.equal(result.profile.role, 'admin');
});
