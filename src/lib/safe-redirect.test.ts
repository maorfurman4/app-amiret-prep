import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('login destination', () => {
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil.test', 'javascript:alert(1)', null])('rejects %s', value => {
    expect(safeRedirectPath(value)).toBe('/');
  });
  it('preserves local paths and query strings', () => {
    expect(safeRedirectPath('/exam?mode=practice#help')).toBe('/exam?mode=practice#help');
    expect(safeRedirectPath('/auth/reset-password')).toBe('/auth/reset-password');
  });
});
