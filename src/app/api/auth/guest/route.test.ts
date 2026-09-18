import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { GUEST_COOKIE, verifyGuestToken } from '@/lib/guest-token';

afterEach(() => vi.unstubAllEnvs());
describe('guest bootstrap', () => {
  it('issues proof independently of any proposed legacy ID, then reuses that proof', async () => {
    vi.stubEnv('GUEST_SIGNING_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'production');
    const requested = '11111111-1111-4111-8111-111111111111';
    const response = await POST(new NextRequest('https://example.test/api/auth/guest', {
      method: 'POST', headers: { origin: 'https://example.test' }, body: JSON.stringify({ guestId: requested }),
    }));
    const data = await response.json();
    const token = response.cookies.get(GUEST_COOKIE)!.value;
    expect(data.guestId).not.toBe(requested);
    expect(verifyGuestToken(token, 'test-secret')).toBe(data.guestId);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('set-cookie')).toMatch(/Secure/i);
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=strict/i);
    const reused = await POST(new NextRequest('https://example.test/api/auth/guest', {
      method: 'POST', headers: { cookie: `${GUEST_COOKIE}=${token}` },
    }));
    expect(await reused.json()).toEqual(data);
  });
  it('rejects cross-origin credential creation and fails closed without a key', async () => {
    expect((await POST(new NextRequest('https://example.test/api/auth/guest', {
      method: 'POST', headers: { origin: 'https://attacker.test' },
    }))).status).toBe(403);
    vi.stubEnv('GUEST_SIGNING_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await POST(new NextRequest('https://example.test/api/auth/guest', { method: 'POST' }))).status).toBe(503);
  });
});
