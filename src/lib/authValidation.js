function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function getPasswordStrength(password) {
  const trimmed = password || '';
  let score = 0;

  if (trimmed.length >= 8) score += 1;
  if (trimmed.length >= 12) score += 1;
  if (/[A-Z]/.test(trimmed)) score += 1;
  if (/[a-z]/.test(trimmed)) score += 1;
  if (/\d/.test(trimmed)) score += 1;
  if (/[^A-Za-z0-9]/.test(trimmed)) score += 1;
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(trimmed)) score += 1;

  if (score <= 2) return { label: 'Weak', level: 'weak', color: '#ef4444' };
  if (score <= 4) return { label: 'Medium', level: 'medium', color: '#f59e0b' };
  if (score <= 6) return { label: 'Strong', level: 'strong', color: '#3b82f6' };
  return { label: 'Very Strong', level: 'very-strong', color: '#10b981' };
}

function validatePassword(password) {
  const trimmed = password || '';

  if (trimmed.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long.' };
  }

  if (/\s/.test(trimmed)) {
    return { ok: false, message: 'Password cannot contain spaces.' };
  }

  if (!/[A-Z]/.test(trimmed) || !/[a-z]/.test(trimmed) || !/\d/.test(trimmed) || !/[^A-Za-z0-9]/.test(trimmed)) {
    return { ok: false, message: 'Password must include uppercase, lowercase, a number, and a symbol.' };
  }

  if (trimmed.length < 12) {
    return { ok: false, message: 'Password should be at least 12 characters for better security.' };
  }

  if (/^(?:123|1234|12345|123456|1234567|12345678|password|password123)$/i.test(trimmed)) {
    return { ok: false, message: 'That password is too common. Please choose a stronger one.' };
  }

  return { ok: true };
}

function hasStoredEmail(storedUsers, email) {
  const normalized = normalizeEmail(email);
  return (storedUsers || []).some((user) => normalizeEmail(user?.email) === normalized);
}

export { normalizeEmail, validatePassword, getPasswordStrength, hasStoredEmail };
