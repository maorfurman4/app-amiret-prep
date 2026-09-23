import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn(), recapCardsToExam: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/srs', () => ({ recapCardsToExam: mocks.recapCardsToExam }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-09-23',
}));

import { GET, PUT } from './route';

function db(goal: Record<string, unknown> | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({
    upsert,
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: goal }) }) }),
  }));
  return { supabase: { from }, upsert };
}
const put = (body: unknown) => PUT(new Request('http://x/api/goals', { method: 'PUT', body: JSON.stringify(body) }));

describe('/api/goals', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.recapCardsToExam.mockResolvedValue({ error: null }); });

  it('GET returns the stored exam date, or defaults for guests', async () => {
    const d = db({ exam_date: '2026-11-01', daily_activity_target: 20 });
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u' } });
    expect(await (await GET()).json()).toEqual({ examDate: '2026-11-01', dailyActivityTarget: 20 });

    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'g' });
    expect(await (await GET()).json()).toEqual({ examDate: null, dailyActivityTarget: 15 });
  });

  it('PUT requires an account', async () => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'g' });
    expect((await put({ examDate: '2026-11-01' })).status).toBe(401);
    expect(d.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['a malformed date', { examDate: '01/11/2026' }],
    ['an impossible date', { examDate: '2026-02-31' }],
    ['a past date', { examDate: '2026-09-22' }],
    ['a date over two years out', { examDate: '2028-12-01' }],
    ['a missing field', {}],
  ])('PUT rejects %s', async (_label, body) => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u' } });
    expect((await put(body)).status).toBe(400);
    expect(d.upsert).not.toHaveBeenCalled();
  });

  it('PUT saves the date and immediately recaps the existing schedule to it', async () => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u' } });
    const res = await put({ examDate: '2026-11-01' });
    expect(res.status).toBe(200);
    expect(d.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u', exam_date: '2026-11-01' }), { onConflict: 'user_id' });
    expect(mocks.recapCardsToExam).toHaveBeenCalledWith(d.supabase, { id: 'u', type: 'user' }, new Date('2026-11-01T06:00:00.000Z'));
  });

  it('PUT null clears the date without recapping', async () => {
    const d = db();
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: { id: 'u' } });
    expect((await put({ examDate: null })).status).toBe(200);
    expect(d.upsert).toHaveBeenCalledWith(expect.objectContaining({ exam_date: null }), { onConflict: 'user_id' });
    expect(mocks.recapCardsToExam).not.toHaveBeenCalled();
  });
});
