import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { GET } from './route';

/**
 * A query builder whose every chain resolves to the next queued result, one
 * per `.from()` call — the route reads `responses` twice (activity, then
 * tagged errors) in that order.
 */
function client(...results: { data: unknown; error: unknown }[]) {
  let call = 0;
  return {
    from() {
      const result = results[call++];
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'not']) b[m] = () => b;
      b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
      return b;
    },
  };
}

describe('GET /api/stats/activity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns practice counts and the error-cause breakdown for the owner', async () => {
    const activity = [{ created_at: '2026-10-01T08:00:00Z' }, { created_at: '2026-10-03T08:00:00Z' }];
    const errors = [{ error_cause: 'vocab' }, { error_cause: 'vocab' }, { error_cause: 'logic' }];
    mocks.getServerClients.mockResolvedValue({
      supabase: client({ data: activity, error: null }, { data: errors, error: null }),
      user: { id: 'u1' }, guestId: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.practice).toEqual({ questions: 2, days: 2 });
    expect(body.errorCauses.total).toBe(3);
    expect(body.errorCauses.top).toBe('vocab');
  });

  it('returns a zeroed, safe payload when there is no owner', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client(), user: null, guestId: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.practice).toEqual({ questions: 0, days: 0 });
    expect(body.errorCauses.total).toBe(0);
  });

  it('fails loudly (503) when a read fails, so the widgets stay hidden rather than show zeros', async () => {
    mocks.getServerClients.mockResolvedValue({
      supabase: client({ data: null, error: { message: 'fetch failed' } }, { data: [], error: null }),
      user: { id: 'u1' }, guestId: null,
    });
    expect((await GET()).status).toBe(503);
  });
});
