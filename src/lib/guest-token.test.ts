import { describe, expect, it } from 'vitest';
import { GUEST_MAX_AGE, issueGuestToken, verifyGuestToken } from './guest-token';

const now = Date.UTC(2026, 8, 17);
const key = 'test-key-never-used-in-production';
describe('guest identity proof', () => {
  it('issues distinct IDs and accepts only their intact signed tokens', () => {
    const a = issueGuestToken(key, now);
    const b = issueGuestToken(key, now);
    expect(a.id).not.toBe(b.id);
    expect(verifyGuestToken(a.token, key, now)).toBe(a.id);
    expect(verifyGuestToken(a.id, key, now)).toBeNull();
    expect(verifyGuestToken(a.token.replace(a.id, b.id), key, now)).toBeNull();
    expect(verifyGuestToken(a.token, 'different-key', now)).toBeNull();
  });
  it('rejects expired, malformed and multibyte signatures without throwing', () => {
    const { token } = issueGuestToken(key, now);
    expect(verifyGuestToken(token, key, now + GUEST_MAX_AGE * 1000)).toBeNull();
    expect(verifyGuestToken(token.replace(/[^.]+$/, 'א'.repeat(43)), key, now)).toBeNull();
    for (const malformed of [undefined, '', 'x.y.z', token + '.extra', token.replace(/\d{10}/, '9999999999')]) {
      expect(verifyGuestToken(malformed, key, now)).toBeNull();
    }
    expect(verifyGuestToken(token, '', now)).toBeNull();
    expect(() => issueGuestToken('')).toThrow();
  });
});
