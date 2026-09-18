import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_COOKIE, issueGuestToken } from './guest-token';
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), cookies: vi.fn(), headers: vi.fn(), adminFactory: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.adminFactory }));
import { getServerClients } from './supabase-server';

describe('server identity boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('GUEST_SIGNING_SECRET', 'test-guest-key');
    mocks.headers.mockResolvedValue(new Headers());
    mocks.cookies.mockResolvedValue({ get: () => undefined, getAll: () => [] });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
  });
  afterEach(() => vi.unstubAllEnvs());
  function cookie(value: string) {
    mocks.cookies.mockResolvedValue({ get: (name: string) => name === GUEST_COOKIE ? { value } : undefined, getAll: () => [] });
  }
  it('accepts a signed cookie, but never a bare UUID', async () => {
    const identity = issueGuestToken('test-guest-key');
    cookie(identity.token);
    expect((await getServerClients()).guestId).toBe(identity.id);
    cookie(identity.id);
    expect((await getServerClients()).guestId).toBeNull();
  });
  it.each(['Bearer expired-token', 'Basic malformed'])('does not downgrade invalid authorization to a guest: %s', async authorization => {
    cookie(issueGuestToken('test-guest-key').token);
    mocks.headers.mockResolvedValue(new Headers({ authorization }));
    expect((await getServerClients()).guestId).toBeNull();
  });
  it('does not attach browser sessions to the privileged database client', async () => {
    await getServerClients();
    const options = mocks.adminFactory.mock.calls[0][2];
    expect(options.cookies).toBeUndefined();
    expect(options.auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  });
});
