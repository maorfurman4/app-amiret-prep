import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn(), predictionBefore: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/official-score', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/official-score')>()),
  predictionBefore: mocks.predictionBefore,
}));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-09-23',
}));

import { DELETE, GET, PUT } from './route';
import { POST as DISMISS } from './dismiss/route';

const SNAP = { app_theta: 1.6, app_se: 0.24, app_score: 132, app_p_exempt: 0.35, app_exams_used: 3, app_days_before: 2 };

function db(existing: Record<string, unknown> | null = null, recentSaves = 0) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn<(fields: Record<string, unknown>) => { eq: typeof updateEq }>(() => ({ eq: updateEq }));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing });
  // The rate-limit count query ends in .gte(); lookups end in .maybeSingle().
  const gte = vi.fn().mockResolvedValue({ count: recentSaves });
  const selectChain = { eq: () => selectChain, maybeSingle, gte };
  const from = vi.fn(() => ({ select: () => selectChain, insert, update, upsert }));
  return { supabase: { from }, insert, update, updateEq, upsert, gte };
}
const put = (body: unknown) => PUT(new Request('http://x/api/official-score', { method: 'PUT', body: JSON.stringify(body) }));

describe('PUT /api/official-score', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.predictionBefore.mockResolvedValue(SNAP); });

  it('requires an account', async () => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'g' });
    expect((await put({ score: 130, testDate: '2026-09-20' })).status).toBe(401);
    expect(d.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['a score below the scale', { score: 49, testDate: '2026-09-20' }],
    ['a score above the scale', { score: 151, testDate: '2026-09-20' }],
    ['a non-integer score', { score: 130.5, testDate: '2026-09-20' }],
    ['an unknown test type', { score: 130, testDate: '2026-09-20', testType: 'toefl' }],
    ['a future test date', { score: 130, testDate: '2026-09-24' }],
    ['a sitting over two years old', { score: 130, testDate: '2024-09-01' }],
  ])('rejects %s', async (_label, body) => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    expect((await put(body)).status).toBe(400);
    expect(d.insert).not.toHaveBeenCalled();
  });

  it('first report stores the score with the pre-test prediction snapshot', async () => {
    const d = db(null);
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    const res = await put({ score: 131, testDate: '2026-09-20' });
    expect(mocks.predictionBefore).toHaveBeenCalledWith(d.supabase, 'u1', '2026-09-20');
    expect(d.insert).toHaveBeenCalledWith({ user_id: 'u1', score: 131, test_date: '2026-09-20', test_type: 'amirnet', source: 'exam_date_prompt', ...SNAP });
    await expect(res.json()).resolves.toEqual({ ok: true, score: 131, prediction: { score: 132, pExempt: 0.35 } });
  });

  it('re-reporting a sitting corrects the score but keeps the ORIGINAL prediction', async () => {
    const d = db({ id: 7, app_score: 128, app_p_exempt: 0.2 });
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    const res = await put({ score: 136, testDate: '2026-09-20', testType: 'amiram' });
    expect(mocks.predictionBefore).not.toHaveBeenCalled();
    expect(d.insert).not.toHaveBeenCalled();
    expect(d.update).toHaveBeenCalledWith(expect.objectContaining({ score: 136, test_type: 'amiram' }));
    expect(d.update.mock.calls[0][0]).not.toHaveProperty('app_score');
    expect(d.updateEq).toHaveBeenCalledWith('id', 7);
    await expect(res.json()).resolves.toMatchObject({ prediction: { score: 128, pExempt: 0.2 } });
  });

  it('stores which entry point the report came from', async () => {
    const d = db(null);
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    await put({ score: 118, testDate: '2026-05-01', source: 'stats' });
    expect(d.insert).toHaveBeenCalledWith(expect.objectContaining({ source: 'stats' }));
    expect((await put({ score: 118, testDate: '2026-05-01', source: 'popup' })).status).toBe(400);
  });

  it('allows at most 5 saves a minute', async () => {
    const d = db(null, 5);
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    expect((await put({ score: 118, testDate: '2026-05-01' })).status).toBe(429);
    expect(d.insert).not.toHaveBeenCalled();
    expect(d.update).not.toHaveBeenCalled();
  });

  it('reports no prediction when the student had no exams before the test', async () => {
    mocks.predictionBefore.mockResolvedValue({ ...SNAP, app_theta: null, app_se: null, app_score: null, app_p_exempt: null });
    const d = db(null);
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    await expect((await put({ score: 120, testDate: '2026-09-20' })).json()).resolves.toMatchObject({ prediction: null });
  });
});

describe('POST /api/official-score/dismiss', () => {
  const post = (body: unknown) => DISMISS(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }));

  it('records "prefer not to share" for that sitting only', async () => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    expect((await post({ testDate: '2026-09-20' })).status).toBe(200);
    expect(d.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', score_prompt_dismissed_for: '2026-09-20' }), { onConflict: 'user_id' });
  });

  it('records a general "prefer not to" for the other entry points', async () => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    expect((await post({ scope: 'general' })).status).toBe(200);
    const saved = d.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(saved).toHaveProperty('score_prompt_dismissed_at');
    expect(saved).not.toHaveProperty('score_prompt_dismissed_for');
    expect((await post({ scope: 'everything' })).status).toBe(400);
  });

  it('requires an account and a valid date', async () => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null });
    expect((await post({ testDate: '2026-09-20' })).status).toBe(401);
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    expect((await post({ testDate: 'yesterday' })).status).toBe(400);
    expect(d.upsert).not.toHaveBeenCalled();
  });
});

describe('GET /api/official-score', () => {
  it('requires an account', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: db().supabase, user: null });
    expect((await GET()).status).toBe(401);
  });

  it('returns the reports, the general dismissal and the completed exam count', async () => {
    const rows = [{ id: 3, test_type: 'amirnet', score: 125, test_date: '2026-05-01', app_score: 118, source: 'stats' }];
    const chain = {
      eq: () => chain,
      not: () => Promise.resolve({ count: 6 }),
      order: () => Promise.resolve({ data: rows, error: null }),
      maybeSingle: () => Promise.resolve({ data: { score_prompt_dismissed_at: null } }),
    };
    mocks.getServerClients.mockResolvedValue({ supabase: { from: () => ({ select: () => chain }) }, user: { id: 'u1' } });
    await expect((await GET()).json()).resolves.toEqual({ scores: rows, dismissedAt: null, completedExams: 6 });
  });
});

describe('DELETE /api/official-score', () => {
  const del = (q: string) => DELETE(new Request(`http://x/api/official-score${q}`, { method: 'DELETE' }));

  function delDb(count: number) {
    const eqs: [string, unknown][] = [];
    const chain = { eq: (k: string, v: unknown) => { eqs.push([k, v]); return eqs.length === 2 ? Promise.resolve({ error: null, count }) : chain; } };
    return { supabase: { from: () => ({ delete: () => chain }) }, eqs };
  }

  it('deletes only the student\'s own report', async () => {
    const d = delDb(1);
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u1' } });
    expect((await del('?id=3')).status).toBe(200);
    expect(d.eqs).toEqual([['id', 3], ['user_id', 'u1']]);
  });

  it('404s when nothing of theirs matched, 400s on a bad id, 401s without an account', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: delDb(0).supabase, user: { id: 'u1' } });
    expect((await del('?id=99')).status).toBe(404);
    expect((await del('?id=abc')).status).toBe(400);
    mocks.getServerClients.mockResolvedValue({ supabase: delDb(1).supabase, user: null });
    expect((await del('?id=3')).status).toBe(401);
  });
});
