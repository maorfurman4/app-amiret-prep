import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { GET } from './route';

/** Every query resolves to `result`. */
function client(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'lt', 'in']) b[m] = () => b;
  b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
  return { from: () => b };
}

describe('GET /api/my-words', () => {
  it('answers 503 — not an empty pack — when the read fails', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: null, error: { message: 'fetch failed' } }), user: { id: 'u1' }, guestId: null });
    expect((await GET()).status).toBe(503);
  });

  it('still returns an empty pack when there are no mistakes', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: client({ data: [], error: null }), user: { id: 'u1' }, guestId: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ words: [] });
  });
});
