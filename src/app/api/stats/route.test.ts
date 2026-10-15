import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { GET } from './route';

/** A query builder whose every chain resolves to `result`. */
function client(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'order']) b[m] = () => b;
  b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
  return { from: () => b };
}

describe('GET /api/stats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the rows of a student with exams', async () => {
    const rows = [{ score: 120, completed_at: '2026-10-01T10:00:00Z', section_results: [] }];
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: rows, error: null }), user: { id: 'u1' }, guestId: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: rows });
  });

  it('returns an empty list for a student with no exams yet', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: [], error: null }), user: { id: 'u1' }, guestId: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [] });
  });

  it('fails loudly when the read fails, so the page shows error + retry, not "first exam"', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: null, error: { message: 'fetch failed' } }), user: { id: 'u1' }, guestId: null });
    expect((await GET()).status).toBe(503);
  });
});
