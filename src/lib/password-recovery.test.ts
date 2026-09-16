import { describe, expect, it } from 'vitest';
import {
  classifyPasswordUpdateError,
  recoveryLinkIsInvalid,
  validateNewPassword,
} from './password-recovery';

describe('password recovery safety rules', () => {
  it('accepts a valid pending recovery link and matching password', () => {
    expect(recoveryLinkIsInvalid('#access_token=token&type=recovery')).toBe(false);
    expect(validateNewPassword('new-password', 'new-password')).toBeNull();
  });

  it('recognizes an expired recovery link returned by Supabase', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(recoveryLinkIsInvalid(hash)).toBe(true);
  });

  it('recognizes the same fail-closed response when a one-time link is reused', () => {
    const reusedLinkHash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(recoveryLinkIsInvalid(reusedLinkHash)).toBe(true);
  });

  it('treats an expired update session as an invalid reset flow', () => {
    expect(classifyPasswordUpdateError({ message: 'Auth session missing', status: 401 }))
      .toEqual({ invalidSession: true, message: null });
  });

  it('validates password length and confirmation locally', () => {
    expect(validateNewPassword('short', 'short')).toContain('6');
    expect(validateNewPassword('long-enough', 'different')).toBe('הסיסמאות אינן זהות');
  });
});
