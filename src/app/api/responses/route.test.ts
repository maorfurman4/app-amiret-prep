import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn(), applyResponsesToSrs: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/srs', () => ({ applyResponsesToSrs: mocks.applyResponsesToSrs }));

import { POST } from './route';

const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const UNKNOWN = '33333333-3333-4333-8333-333333333333';

/** Answer keys the fake DB knows about: A → 2, B → 0. */
function createSupabase({ insertError = null as unknown } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const inFn = vi.fn().mockResolvedValue({
    data: [{ id: ITEM_A, correct_answer: 2 }, { id: ITEM_B, correct_answer: 0 }],
    error: null,
  });
  const select = vi.fn().mockReturnValue({ in: inFn });
  const from = vi.fn((table: string) => (table === 'questions' ? { select } : { insert }));
  return { supabase: { from }, insert, from };
}

function request(body: unknown) {
  return new Request('http://localhost/api/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const entry = (overrides: Record<string, unknown> = {}) => ({
  itemId: ITEM_A, context: 'practice', chosenOption: 2, latencyMs: 4200, ...overrides,
});

describe('POST /api/responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyResponsesToSrs.mockResolvedValue({ created: 0, reviewed: 0, cleared: 0, error: null });
  });

  it('requires an identity', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: null });
    const res = await POST(request({ responses: [entry()] }));
    expect(res.status).toBe(401);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['empty batch', { responses: [] }],
    ['exam context (server-only)', { responses: [entry({ context: 'exam' })] }],
    ['option out of range', { responses: [entry({ chosenOption: 4 })] }],
    ['non-uuid item', { responses: [entry({ itemId: 'nope' })] }],
    ['negative latency', { responses: [entry({ latencyMs: -1 })] }],
    ['oversized batch', { responses: Array.from({ length: 26 }, () => entry()) }],
  ])('rejects %s', async (_label, body) => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    const res = await POST(request(body));
    expect(res.status).toBe(400);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('grades against the stored key, never the client', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });

    const res = await POST(request({ responses: [
      entry({ itemId: ITEM_A, chosenOption: 2, correct: false }), // client lies; key says right
      entry({ itemId: ITEM_B, chosenOption: 3, context: 'review', latencyMs: 900 }),
      entry({ itemId: ITEM_B, chosenOption: null, context: 'practice', latencyMs: null }),
    ] }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, recorded: 3 });
    expect(db.insert).toHaveBeenCalledWith([
      expect.objectContaining({ owner_id: 'guest-1', owner_type: 'guest', item_id: ITEM_A, correct: true, chosen_option: 2, latency_ms: 4200, context: 'practice' }),
      expect.objectContaining({ item_id: ITEM_B, correct: false, chosen_option: 3, latency_ms: 900, context: 'review' }),
      expect.objectContaining({ item_id: ITEM_B, correct: false, chosen_option: null, latency_ms: null }),
    ]);
  });

  it('attributes rows to the signed-in account over a guest cookie', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'user-1' }, guestId: 'guest-1' });
    await POST(request({ responses: [entry({ confidence: 3, thetaBefore: 0.5, sectionIndex: 2, context: 'diagnostic' })] }));
    expect(db.insert).toHaveBeenCalledWith([
      expect.objectContaining({ owner_id: 'user-1', owner_type: 'user', confidence: 3, theta_before: 0.5, section_index: 2, context: 'diagnostic' }),
    ]);
  });

  it('drops responses for items that do not exist', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    const res = await POST(request({ responses: [entry({ itemId: UNKNOWN }), entry()] }));
    await expect(res.json()).resolves.toMatchObject({ ok: true, recorded: 1 });
    expect(db.insert.mock.calls[0][0]).toHaveLength(1);
  });

  it('feeds the server-graded rows (never client claims) to the SRS engine', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'user-1' }, guestId: null });
    await POST(request({ responses: [
      entry({ itemId: ITEM_A, chosenOption: 1, correct: true, latencyMs: 700 }),
      entry({ itemId: UNKNOWN }),
    ] }));
    expect(mocks.applyResponsesToSrs).toHaveBeenCalledWith(db.supabase, { id: 'user-1', type: 'user' }, [
      { itemId: ITEM_A, correct: false, latencyMs: 700, confidence: null },
    ]);
  });

  it('still reports the answers as logged when scheduling throws', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    mocks.applyResponsesToSrs.mockRejectedValue(new Error('db down'));
    const res = await POST(request({ responses: [entry()] }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, recorded: 1 });
  });

  it('reports a write failure instead of claiming success', async () => {
    const db = createSupabase({ insertError: { message: 'boom' } });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    const res = await POST(request({ responses: [entry()] }));
    expect(res.status).toBe(500);
  });
});
