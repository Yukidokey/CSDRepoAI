import test from 'node:test';
import assert from 'node:assert/strict';
import { getFallbackUserForCredentials } from './AuthContext.jsx';

test('returns the built-in admin fallback user for admin credentials even when another fallback account exists', () => {
  const storedUser = {
    id: 'local-123',
    email: 'student@csdrepoai.com',
    password: 'studentpass',
    full_name: 'Student User',
    role: 'student',
  };

  global.window = {
    localStorage: {
      getItem: () => JSON.stringify(storedUser),
      setItem: () => {},
      removeItem: () => {},
    },
  };

  const result = getFallbackUserForCredentials('admin@csdrepoai.com', 'Penelope890');
  assert.ok(result);
  assert.equal(result.email, 'admin@csdrepoai.com');
  assert.equal(result.role, 'admin');
});
