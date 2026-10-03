import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { POST } from './route';

const questions = Array.from({ length: 4 }, (_, i) => ({ id: `q${i + 1}` }));

function session(overrides: Record<string, unknown> = {}) {
  return {
    current_section_index: 2,
    current_section_expires_at: '2026-09-16T10:00:00.000Z',
    completed_at: null,
    is_practice: false,
    questions_by_section: { 1: questions, 2: questions },
    answers_by_section: { 1: [0, 1, 2, 3] },
    ...overrides,
  };
}

/** Records the read filters and the conditional update. */
function db(row: Record<string, unknown> | null, updated: { id: string }[] = [{ id: 's' }]) {
  const readFilters: [string, unknown][] = [];
  const updateFilters: [string, unknown][] = [];
  let updateValues: Record<string, unknown> | null = null;

  const read = {
    eq: (col: string, val: unknown) => { readFilters.push([col, val]); return read; },
    maybeSingle: async () => ({ data: row && readFilters.some(([c, v]) => c === 'user_id' && v === 'owner') ? row : null, error: null }),
  };
  const write = {
    eq: (col: string, val: unknown) => { updateFilters.push([col, val]); return write; },
    is: (col: string, val: unknown) => { updateFilters.push([`${col} is`, val]); return write; },
    select: async () => ({ data: updated, error: null }),
  };
  const from = vi.fn(() => ({
    select: () => read,
    update: (values: Record<string, unknown>) => { updateValues = values; return write; },
  }));
  return { supabase: { from }, readFilters, updateFilters, get updateValues() { return updateValues; } };
}

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/exam/progress', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}));
const body = (overrides: Record<string, unknown> = {}) => ({ sessionId: 's', sectionIndex: 2, answers: [1, null, 3, null], ...overrides });

describe('POST /api/exam/progress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T09:58:00.000Z')); // two minutes left
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('saves the running section in its own slot, keeping earlier sections, guarded on the section', async () => {
    const d = db(session());
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(d.updateValues).toEqual({ answers_by_section: { 1: [0, 1, 2, 3], 2: [1, null, 3, null] } });
    expect(d.updateFilters).toEqual(expect.arrayContaining([
      ['id', 's'], ['user_id', 'owner'], ['current_section_index', 2], ['completed_at is', null],
    ]));
  });

  it('writes nothing but that one slot — no other column, no other table', async () => {
    const d = db(session());
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
    await post(body());
    expect(Object.keys(d.updateValues ?? {})).toEqual(['answers_by_section']);
    expect((d.supabase.from.mock.calls as unknown as [string][]).every(([table]) => table === 'exam_sessions')).toBe(true);
  });

  it('accepts a save inside the 20 s grace after the deadline', async () => {
    vi.setSystemTime(new Date('2026-09-16T10:00:19.000Z'));
    const d = db(session());
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
    expect((await post(body())).status).toBe(200);
  });

  it('refuses a save after the deadline — what was saved in time stands', async () => {
    vi.setSystemTime(new Date('2026-09-16T10:00:21.000Z'));
    const d = db(session());
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
    const res = await post(body());
    expect(res.status).toBe(409);
    expect(d.updateValues).toBeNull();
  });

  it('refuses someone else’s exam (not found for this owner)', async () => {
    const d = db(session());
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'intruder' });
    const res = await post(body());
    expect(res.status).toBe(404);
    expect(d.readFilters).toContainEqual(['user_id', 'intruder']);
    expect(d.updateValues).toBeNull();
  });

  it('refuses without any identity', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: db(session()).supabase, user: null, guestId: null });
    expect((await post(body())).status).toBe(401);
  });

  it('refuses a section the exam is not on (earlier or later)', async () => {
    for (const sectionIndex of [1, 3]) {
      const d = db(session());
      mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
      expect((await post(body({ sectionIndex }))).status).toBe(409);
      expect(d.updateValues).toBeNull();
    }
  });

  it('refuses a completed exam', async () => {
    const d = db(session({ completed_at: '2026-09-16T09:50:00.000Z' }));
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
    expect((await post(body())).status).toBe(409);
    expect(d.updateValues).toBeNull();
  });

  it('refuses an answer list that doesn’t fit the section, or out-of-range answers', async () => {
    for (const answers of [[1, 2], [1, 2, 3, 4, 0], [1, 2, 3, 7]]) {
      const d = db(session());
      mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
      expect((await post(body({ answers }))).status).toBe(400);
      expect(d.updateValues).toBeNull();
    }
  });

  it('refuses a practice exam (untimed — nothing to protect)', async () => {
    const d = db(session({ is_practice: true, current_section_expires_at: null }));
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
    expect((await post(body())).status).toBe(400);
    expect(d.updateValues).toBeNull();
  });

  it('reports a conflict when a submit moved the section on between the read and the write', async () => {
    const d = db(session(), []);
    mocks.getServerClients.mockResolvedValue({ supabase: d.supabase, user: null, guestId: 'owner' });
    expect((await post(body())).status).toBe(409);
  });
});
