import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn(), applyResponsesToSrs: vi.fn(), estimateOwnerTheta: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/srs', () => ({ applyResponsesToSrs: mocks.applyResponsesToSrs }));
vi.mock('@/lib/ability', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/ability')>()),
  estimateOwnerTheta: mocks.estimateOwnerTheta,
}));
vi.mock('@/lib/date-local', () => ({ todayLocalStr: () => '2026-09-23' }));

import { POST } from './route';

const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const UNKNOWN = '33333333-3333-4333-8333-333333333333';

/** Answer keys the fake DB knows about: A → 2 (b = 0), B → 0 (b = 2). */
function createSupabase({ insertError = null as unknown } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const inFn = vi.fn().mockResolvedValue({
    data: [{ id: ITEM_A, correct_answer: 2, b: 0, c: 0.25 }, { id: ITEM_B, correct_answer: 0, b: 2, c: 0.25 }],
    error: null,
  });
  const select = vi.fn().mockReturnValue({ in: inFn });
  const from = vi.fn((table: string) => (table === 'questions' ? { select } : { insert }));
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return { supabase: { from, rpc }, insert, from, rpc };
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
    mocks.estimateOwnerTheta.mockResolvedValue(0);
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
      { itemId: ITEM_A, correct: false, answered: true, latencyMs: 700, confidence: null },
    ]);
  });

  it('p_correct comes from the SERVER ability estimate, never a client-sent theta', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    mocks.estimateOwnerTheta.mockResolvedValue(0);
    await POST(request({ responses: [
      // Diagnostic claims θ = 3.9 (would make every item "easy"); ignored for p_correct.
      entry({ itemId: ITEM_A, context: 'diagnostic', thetaBefore: 3.9 }),
      entry({ itemId: ITEM_B }),
    ] }));
    const [rowA, rowB] = db.insert.mock.calls[0][0];
    // θ = 0 vs b = 0 (a = 1.2, c = .25): P = .25 + .75/2 — in the sweet spot.
    expect(rowA.p_correct).toBeCloseTo(0.625, 6);
    expect(rowA.theta_before).toBe(3.9); // the client value is kept as context only
    // θ = 0 vs b = 2: well below the sweet spot.
    expect(rowB.p_correct).toBeCloseTo(0.25 + 0.75 / (1 + Math.exp(2.4)), 6);
    expect(rowB.theta_before).toBe(0); // otherwise the server estimate is recorded
  });

  it('marks today active for the streak from the verified answers (no unit counts)', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    await POST(request({ responses: [entry({ context: 'review' })] }));
    expect(db.rpc).toHaveBeenCalledWith('increment_daily_activity', {
      p_user_id: 'guest-1', p_activity_date: '2026-09-23', p_source: 'review', p_activity_units: 0, p_review_cleared: 0,
    });
  });

  it('marks nothing when no answer was actually recorded', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    await POST(request({ responses: [entry({ itemId: UNKNOWN })] }));
    expect(db.rpc).not.toHaveBeenCalled();
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
