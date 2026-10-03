import { describe, expect, it } from 'vitest';
import {
  classifySignInError,
  classifySignUpError,
  inboxFor,
  signUpHitExistingAccount,
  validateEmail,
  validatePassword,
} from './auth-messages';

describe('classifySignInError', () => {
  it('tells an unconfirmed account to confirm — never that the password is wrong', () => {
    const r = classifySignInError({ code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' });
    expect(r.kind).toBe('email_not_confirmed');
    expect(r.message).not.toMatch(/סיסמה/);
  });

  it('recognises an unconfirmed account by message when the code is absent', () => {
    expect(classifySignInError({ status: 400, message: 'Email not confirmed' }).kind).toBe('email_not_confirmed');
  });

  it('maps bad credentials to the wrong-email-or-password message', () => {
    const r = classifySignInError({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' });
    expect(r.kind).toBe('invalid_credentials');
    expect(r.message).toMatch(/סיסמה/);
  });

  it('reports a failed request as a connection problem, not bad credentials', () => {
    for (const err of [
      { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 },
      { message: 'fetch failed' },
      { status: 503, message: 'Service Unavailable' },
    ]) {
      expect(classifySignInError(err).kind).toBe('network');
    }
  });

  it('detects rate limiting', () => {
    expect(classifySignInError({ status: 429, message: 'Too many requests' }).kind).toBe('rate_limited');
    expect(classifySignInError({ status: 400, code: 'over_request_rate_limit', message: '' }).kind).toBe('rate_limited');
  });
});

describe('classifySignUpError', () => {
  it('recognises an existing account', () => {
    expect(classifySignUpError({ code: 'user_already_exists', status: 422, message: 'User already registered' }).kind).toBe('already_registered');
    expect(classifySignUpError({ status: 400, message: 'User already registered' }).kind).toBe('already_registered');
  });

  it('recognises a weak password', () => {
    expect(classifySignUpError({ code: 'weak_password', status: 422, message: 'Password should be at least 6 characters' }).kind).toBe('weak_password');
  });

  it('explains a confirmation email that could not be sent', () => {
    const r = classifySignUpError({ status: 500, message: 'Error sending confirmation email' });
    expect(r.message).toMatch(/מייל האישור/);
  });

  it('reports network failures as such', () => {
    expect(classifySignUpError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }).kind).toBe('network');
  });
});

describe('signUpHitExistingAccount', () => {
  it('spots Supabase\'s obfuscated "already registered" success', () => {
    expect(signUpHitExistingAccount({ identities: [] })).toBe(true);
  });
  it('treats a genuinely new user as new', () => {
    expect(signUpHitExistingAccount({ identities: [{ id: 'x' }] })).toBe(false);
    expect(signUpHitExistingAccount(null)).toBe(false);
    expect(signUpHitExistingAccount({})).toBe(false);
  });
});

describe('validateEmail', () => {
  it('accepts ordinary addresses, ignoring surrounding spaces', () => {
    expect(validateEmail('dana@gmail.com')).toBeNull();
    expect(validateEmail('  first.last+tag@sub.example.co.il ')).toBeNull();
  });
  it.each(['', '   ', 'dana', 'dana@', 'dana@gmail', 'da na@gmail.com'])('rejects %j', value => {
    expect(validateEmail(value)).not.toBeNull();
  });
});

describe('validatePassword', () => {
  it('requires something in both modes', () => {
    expect(validatePassword('', 'login')).not.toBeNull();
    expect(validatePassword('', 'signup')).not.toBeNull();
  });
  it('enforces the minimum length only when creating a password', () => {
    expect(validatePassword('abc', 'login')).toBeNull();
    expect(validatePassword('abc', 'signup')).toMatch(/חסרים עוד 3/);
    expect(validatePassword('abcdef', 'signup')).toBeNull();
  });
});

describe('inboxFor', () => {
  it('links known webmail providers', () => {
    expect(inboxFor('dana@gmail.com')?.label).toMatch(/Gmail/);
    expect(inboxFor('dana@Hotmail.com')?.label).toMatch(/Outlook/);
  });
  it('offers nothing for unknown domains or malformed input', () => {
    expect(inboxFor('dana@school.ac.il')).toBeNull();
    expect(inboxFor('dana')).toBeNull();
  });
});
