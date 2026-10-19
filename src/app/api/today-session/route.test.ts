import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { GET } from './route';

describe('GET /api/today-session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires an identity (auth or guest cookie)', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: { from: vi.fn() }, user: null, guestId: null });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  /** Every query resolves to `result`; srs_cards/RPC included. */
  function client(result: { data: unknown; error: unknown }) {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'lte', 'gte', 'in', 'not', 'order', 'limit', 'range']) b[m] = () => b;
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
    return { from: () => b, rpc: () => Promise.resolve(result) };
  }

  it('answers 503 — not "all caught up" — when the reads fail', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: null, error: { message: 'fetch failed' } }), user: { id: 'u1' }, guestId: null });
    expect((await GET()).status).toBe(503);
  });

  it('still reports a genuinely empty day as zero items', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: [], error: null }), user: { id: 'u1' }, guestId: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).totalItems).toBe(0);
  });

  it('says whose vocab words these are (signed-in user), and none for a guest', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: [], error: null }), user: { id: 'u1' }, guestId: null });
    expect((await (await GET()).json()).vocabOwnerId).toBe('u1');
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: [], error: null }), user: null, guestId: 'g1' });
    expect((await (await GET()).json()).vocabOwnerId).toBeNull();
  });
});
