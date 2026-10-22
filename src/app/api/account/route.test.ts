import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked Supabase only: nothing here can reach a real database.
const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { DELETE } from './route';
import { DELETE_CONFIRMATION } from '@/lib/account-deletion';

type Filter = [column: string, value: unknown];

/** Every user-keyed public table in the live schema (checked 2026-10-22). */
const EXPECTED: Record<string, Filter[]> = {
  responses: [['owner_id', 'me'], ['owner_type', 'user']],
  srs_review_log: [['owner_id', 'me'], ['owner_type', 'user']],
  srs_cards: [['owner_id', 'me'], ['owner_type', 'user']],
  exam_sessions: [['user_id', 'me']],
  review_queue: [['user_id', 'me']],
  activity_log: [['user_id', 'me']],
  user_question_history: [['user_key', 'me']],
  user_passage_history: [['user_key', 'me']],
  user_vocab_known: [['user_id', 'me']],
  user_vocab_favorites: [['user_id', 'me']],
  official_scores: [['user_id', 'me']],
  user_goals: [['user_id', 'me']],
  user_stats: [['user_id', 'me']],
};

function setup({ user = { id: 'me' } as { id: string } | null, failTable = '', adminError = null as unknown, authError = null as unknown } = {}) {
  const deletes: { table: string; filters: Filter[] }[] = [];
  const from = vi.fn((table: string) => ({
    delete: () => {
      const entry = { table, filters: [] as Filter[] };
      deletes.push(entry);
      const q = {
        eq: (column: string, value: unknown) => { entry.filters.push([column, value]); return q; },
        then: (resolve: (r: { error: unknown }) => void) => resolve({ error: table === failTable ? { message: 'boom' } : null }),
      };
      return q;
    },
  }));
  const remove = vi.fn().mockResolvedValue({ error: null });
  const deleteUser = vi.fn().mockResolvedValue({ error: authError });
  const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: adminError });
  const supabase = { from, storage: { from: () => ({ remove }) }, auth: { admin: { getUserById, deleteUser } } };
  mocks.getServerClients.mockResolvedValue({ supabase, user, guestId: 'guest-cookie-id' });
  return { deletes, remove, deleteUser, getUserById };
}

const req = (body: unknown) =>
  new Request('http://localhost/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('DELETE /api/account', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a caller with no account and deletes nothing', async () => {
    const m = setup({ user: null });
    expect((await DELETE(req({ confirm: DELETE_CONFIRMATION }))).status).toBe(401);
    expect(m.deletes).toEqual([]);
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it('requires the explicit confirmation body', async () => {
    const m = setup();
    expect((await DELETE(req({}))).status).toBe(400);
    expect((await DELETE(new Request('http://localhost/api/account', { method: 'DELETE' }))).status).toBe(400);
    expect(m.deletes).toEqual([]);
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes only the caller's own rows, in every user-keyed table, then the auth user", async () => {
    const m = setup();
    // An id in the body must never be honoured.
    const res = await DELETE(req({ confirm: DELETE_CONFIRMATION, userId: 'someone-else' }));
    expect(res.status).toBe(200);

    expect(Object.fromEntries(m.deletes.map(d => [d.table, d.filters]))).toEqual(EXPECTED);
    expect(m.deletes).toHaveLength(Object.keys(EXPECTED).length);
    for (const d of m.deletes) {
      const values = d.filters.map(([, v]) => v);
      expect(values).not.toContain('someone-else');
      expect(values).not.toContain('guest-cookie-id');
    }
    expect(m.remove).toHaveBeenCalledWith(['me/avatar.jpg', 'me/avatar.png', 'me/avatar.webp', 'me/avatar.gif']);
    expect(m.deleteUser).toHaveBeenCalledExactlyOnceWith('me');
  });

  it('deletes the auth user last, only after every table succeeded', async () => {
    const m = setup({ failTable: 'exam_sessions' });
    expect((await DELETE(req({ confirm: DELETE_CONFIRMATION }))).status).toBe(500);
    expect(m.deletes.map(d => d.table)).not.toContain('user_stats');
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it('touches no data when the server cannot delete auth users (no service role)', async () => {
    const m = setup({ adminError: { status: 403, message: 'not admin' } });
    expect((await DELETE(req({ confirm: DELETE_CONFIRMATION }))).status).toBe(503);
    expect(m.deletes).toEqual([]);
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it('reports a failed auth deletion so the student can retry', async () => {
    setup({ authError: { message: 'auth down' } });
    expect((await DELETE(req({ confirm: DELETE_CONFIRMATION }))).status).toBe(500);
  });
});
