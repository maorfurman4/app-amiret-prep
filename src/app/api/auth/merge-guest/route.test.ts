import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));

vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { POST } from './route';

const accountId = '11111111-1111-4111-8111-111111111111';
const guestId = '22222222-2222-4222-8222-222222222222';

function createSupabase(lookupResult: { data: unknown; error: unknown }) {
  const getUserById = vi.fn().mockResolvedValue(lookupResult);
  const from = vi.fn();
  return {
    supabase: { auth: { admin: { getUserById } }, from },
    spies: { getUserById, from },
  };
}

function mergeRequest(body: unknown = {}) {
  return new Request('http://localhost/api/auth/merge-guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/merge-guest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires an authenticated account', async () => {
    const db = createSupabase({ data: null, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null });

    const response = await POST(mergeRequest());

    expect(response.status).toBe(401);
    expect(db.spies.getUserById).not.toHaveBeenCalled();
  });

  it('treats a missing guest cookie as "nothing to merge", not an error', async () => {
    const db = createSupabase({ data: null, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId }, guestId: null });

    const response = await POST(mergeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, guest: false, mergedExams: 0 });
    // Without cookie proof nothing guest-owned may be looked up or moved.
    expect(db.spies.getUserById).not.toHaveBeenCalled();
    expect(db.spies.from).not.toHaveBeenCalled();
  });

  it('still carries locally-kept vocab onto the account when there is no guest cookie', async () => {
    const wordId = '33333333-3333-4333-8333-333333333333';
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const tables: string[] = [];
    const from = vi.fn((table: string) => {
      tables.push(table);
      return {
        select: () => ({ in: () => Promise.resolve({ data: [{ id: wordId }] }) }),
        upsert,
      };
    });
    const getUserById = vi.fn();
    mocks.getServerClients.mockResolvedValue({
      supabase: { auth: { admin: { getUserById } }, from }, user: { id: accountId }, guestId: null,
    });

    const response = await POST(mergeRequest({ vocabKnown: [wordId, 'not-a-uuid'], vocabFavorites: [wordId] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, mergedVocabKnown: 1, mergedVocabFavorites: 1 });
    expect(tables).toEqual(['vocabulary', 'user_vocab_known', 'user_vocab_favorites']);
    expect(upsert).toHaveBeenCalledWith([{ user_id: accountId, word_id: wordId }], expect.anything());
    expect(getUserById).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each([
    { label: 'malformed id', candidate: 'not-a-uuid' },
    { label: 'the current account id', candidate: accountId },
  ])('rejects $label before querying any user data', async ({ candidate }) => {
    const db = createSupabase({ data: null, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId }, guestId: candidate });

    const response = await POST(mergeRequest());

    expect(response.status).toBe(400);
    expect(db.spies.getUserById).not.toHaveBeenCalled();
    expect(db.spies.from).not.toHaveBeenCalled();
  });

  it('rejects before querying anything even with a malformed JSON body', async () => {
    const db = createSupabase({ data: null, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId }, guestId: 'not-a-uuid' });

    const badBodyRequest = new Request('http://localhost/api/auth/merge-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    const response = await POST(badBodyRequest);

    expect(response.status).toBe(400);
    expect(db.spies.from).not.toHaveBeenCalled();
  });

  it('refuses to transfer data owned by another registered account', async () => {
    const db = createSupabase({ data: { user: { id: guestId } }, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId }, guestId });

    const response = await POST(mergeRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid guestId' });
    expect(db.spies.from).not.toHaveBeenCalled();
  });

  it('fails closed when Supabase cannot verify whether the id is registered', async () => {
    const db = createSupabase({ data: null, error: { status: 500, message: 'unavailable' } });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: accountId }, guestId });

    const response = await POST(mergeRequest());

    expect(response.status).toBe(503);
    expect(db.spies.from).not.toHaveBeenCalled();
  });
});
