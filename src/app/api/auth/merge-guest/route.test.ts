import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));

vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { POST } from './route';

const accountId = '11111111-1111-4111-8111-111111111111';
const guestId = '22222222-2222-4222-8222-222222222222';

function request(body: unknown) {
  return new NextRequest('http://localhost/api/auth/merge-guest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createSupabase(lookupResult: { data: unknown; error: unknown }) {
  const getUserById = vi.fn().mockResolvedValue(lookupResult);
  const from = vi.fn();
  return {
    supabase: { auth: { admin: { getUserById } }, from },
    spies: { getUserById, from },
  };
}

describe('POST /api/auth/merge-guest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires an authenticated account', async () => {
    const db = createSupabase({ data: null, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null });

    const response = await POST(request({ guestId }));

    expect(response.status).toBe(401);
    expect(db.spies.getUserById).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'malformed id', candidate: 'not-a-uuid' },
    { label: 'the current account id', candidate: accountId },
  ])('rejects $label before querying any user data', async ({ candidate }) => {
    const db = createSupabase({ data: null, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId } });

    const response = await POST(request({ guestId: candidate }));

    expect(response.status).toBe(400);
    expect(db.spies.getUserById).not.toHaveBeenCalled();
    expect(db.spies.from).not.toHaveBeenCalled();
  });

  it('refuses to transfer data owned by another registered account', async () => {
    const db = createSupabase({ data: { user: { id: guestId } }, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId } });

    const response = await POST(request({ guestId }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid guestId' });
    expect(db.spies.from).not.toHaveBeenCalled();
  });

  it('fails closed when Supabase cannot verify whether the id is registered', async () => {
    const db = createSupabase({ data: null, error: { status: 500, message: 'unavailable' } });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId } });

    const response = await POST(request({ guestId }));

    expect(response.status).toBe(503);
    expect(db.spies.from).not.toHaveBeenCalled();
  });
});
