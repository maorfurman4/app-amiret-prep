import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { POST } from './route';

const REF = '00000000-0000-4000-8000-0000000000aa';
const SESSION = '00000000-0000-4000-8000-0000000000bb';
const ITEM = '00000000-0000-4000-8000-0000000000cc';

function client(result: { data: unknown; error: unknown }, user: { id: string } | null = { id: 'user-1' }) {
  const filters: [string, unknown][] = [];
  let update: unknown = null;
  const query = {
    update: vi.fn((u: unknown) => { update = u; return query; }),
    eq: vi.fn((col: string, val: unknown) => { filters.push([col, val]); return query; }),
    select: vi.fn(async () => result),
  };
  mocks.getServerClients.mockResolvedValue({ supabase: { from: vi.fn(() => query) }, user, guestId: null });
  return { filters, getUpdate: () => update };
}

const post = (body: unknown) => POST(new Request('http://localhost/api/responses/tag', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}));

describe('POST /api/responses/tag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tags a browser-logged row by client ref — own, wrong answers only', async () => {
    const { filters, getUpdate } = client({ data: [{ id: 1 }], error: null });
    const res = await post({ clientRef: REF, cause: 'logic' });
    expect(res.status).toBe(200);
    expect(getUpdate()).toMatchObject({ error_cause: 'logic' });
    expect(filters).toEqual(expect.arrayContaining([['owner_id', 'user-1'], ['correct', false], ['client_ref', REF]]));
  });

  it('tags an exam row by session and item', async () => {
    const { filters } = client({ data: [{ id: 2 }], error: null });
    const res = await post({ sessionId: SESSION, itemId: ITEM, cause: 'time' });
    expect(res.status).toBe(200);
    expect(filters).toEqual(expect.arrayContaining([['session_id', SESSION], ['item_id', ITEM], ['correct', false]]));
  });

  it('clears a tag with cause null', async () => {
    const { getUpdate } = client({ data: [{ id: 1 }], error: null });
    await post({ clientRef: REF, cause: null });
    expect(getUpdate()).toEqual({ error_cause: null, error_tagged_at: null });
  });

  it('returns 409 while the row is not there yet', async () => {
    client({ data: [], error: null });
    expect((await post({ clientRef: REF, cause: 'vocab' })).status).toBe(409);
  });

  it('rejects unknown causes and requires an identity', async () => {
    client({ data: [{ id: 1 }], error: null });
    expect((await post({ clientRef: REF, cause: 'guess' })).status).toBe(400);
    client({ data: [{ id: 1 }], error: null }, null);
    expect((await post({ clientRef: REF, cause: 'vocab' })).status).toBe(401);
  });
});
