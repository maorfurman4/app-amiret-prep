import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));

vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { GET } from './route';

function request(query = '') {
  return new NextRequest(`http://localhost/api/exam/results${query}`);
}

function createSupabase(result: { data: unknown; error: unknown }) {
  const eq = vi.fn();
  const single = vi.fn().mockResolvedValue(result);
  const chain = { eq, single };
  eq.mockReturnValue(chain);
  const select = vi.fn().mockReturnValue(chain);
  const from = vi.fn().mockReturnValue({ select });
  return { supabase: { from }, spies: { from, select, eq, single } };
}

describe('GET /api/exam/results', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a session id and an owner', async () => {
    const db = createSupabase({ data: null, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null });

    expect((await GET(request())).status).toBe(400);
    expect((await GET(request('?sessionId=session'))).status).toBe(401);
    expect(db.spies.from).not.toHaveBeenCalled();
  });

  it('uses the authenticated user even when an attacker supplies another guest id', async () => {
    const db = createSupabase({ data: null, error: { message: 'not found' } });
    mocks.getServerClients.mockResolvedValue({
      supabase: db.supabase,
      user: { id: 'authenticated-user' },
    });

    const response = await GET(request('?sessionId=session&guestId=other-user'));

    expect(response.status).toBe(404);
    expect(db.spies.eq).toHaveBeenNthCalledWith(1, 'id', 'session');
    expect(db.spies.eq).toHaveBeenNthCalledWith(2, 'user_id', 'authenticated-user');
  });

  it('does not expose a real exam answer key before completion', async () => {
    const db = createSupabase({
      data: { is_practice: false, completed_at: null, questions_by_section: { 1: [] } },
      error: null,
    });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'owner' } });

    const response = await GET(request('?sessionId=session'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Exam not finished' });
  });

  it.each([
    { label: 'completed real exam', session: { is_practice: false, completed_at: '2026-09-16T07:00:00Z' } },
    { label: 'practice exam', session: { is_practice: true, completed_at: null } },
  ])('returns results for a $label', async ({ session }) => {
    const db = createSupabase({ data: session, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'owner' } });

    const response = await GET(request('?sessionId=session'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ session });
  });
});
