import { describe, expect, it } from 'vitest';
import { authCallbackUrl, parseAuthFlow } from './auth-redirect';

describe('authCallbackUrl', () => {
  it('routes through the callback with the destination and the flow', () => {
    const url = new URL(authCallbackUrl('https://app.test', '/practice?x=1', 'signup'));
    expect(url.origin + url.pathname).toBe('https://app.test/auth/callback');
    expect(url.searchParams.get('next')).toBe('/practice?x=1');
    expect(url.searchParams.get('flow')).toBe('signup');
  });

  it('never lets `next` point off-site', () => {
    const url = new URL(authCallbackUrl('https://app.test', '//evil.example', 'oauth'));
    expect(url.searchParams.get('next')).toBe('/');
  });
});

describe('parseAuthFlow', () => {
  it('accepts known flows and defaults everything else to oauth', () => {
    expect(parseAuthFlow('signup')).toBe('signup');
    expect(parseAuthFlow('recovery')).toBe('recovery');
    expect(parseAuthFlow('anything')).toBe('oauth');
    expect(parseAuthFlow(null)).toBe('oauth');
  });
});
