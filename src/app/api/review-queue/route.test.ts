import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn(), selectDueReviewQuestions: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/srs', () => ({ selectDueReviewQuestions: mocks.selectDueReviewQuestions }));

import { GET, DELETE } from './route';

const due = {
  id: 'sib', type: 'sentence_completion', text: 't',
  options: ['a', 'b', 'c', 'd'].map(t => ({ id: t, text: t })), correct_answer: 1,
  a: 1.2, b: 0, c: 0.25, difficulty_level: 3,
  review: { conceptKey: 'sc.vocab/b', sibling: true },
};

/** Records the delete chain's filters. */
function deleteDb(conceptKey: string | null = 'sc.vocab/replace') {
  const filters: [string, unknown][] = [];
  const chain = {
    eq: (c: string, v: unknown) => { filters.push([c, v]); return chain; },
    then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
  };
  const lookup = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: conceptKey ? { concept_key: conceptKey } : null }) }) }) };
  const from = vi.fn((table: string) => (table === 'questions' ? lookup : { delete: () => chain }));
  return { supabase: { from }, filters, from };
}

describe('/api/review-queue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET serves due concept cards (with sibling metadata), options reshuffled, for the verified owner', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: {}, user: null, guestId: 'guest-1' });
    mocks.selectDueReviewQuestions.mockResolvedValue({ questions: [due], error: null });
    const body = await (await GET()).json();
    expect(mocks.selectDueReviewQuestions).toHaveBeenCalledWith({}, { id: 'guest-1', type: 'guest' });
    expect(body.count).toBe(1);
    const served = body.questions[0];
    expect(served.review).toEqual({ conceptKey: 'sc.vocab/b', sibling: true });
    expect(served.options[served.correct_answer].text).toBe('b');
    expect([...served.option_order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('GET without any identity returns an empty queue', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: {}, user: null, guestId: null });
    expect(await (await GET()).json()).toEqual({ questions: [], count: 0 });
    expect(mocks.selectDueReviewQuestions).not.toHaveBeenCalled();
  });

  it('DELETE ?questionId removes the card for that question’s concept (works for siblings too)', async () => {
    const db = deleteDb('sc.vocab/replace');
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'user-1' } });
    const res = await DELETE(new NextRequest('http://x/api/review-queue?questionId=sib'));
    expect(res.status).toBe(200);
    expect(db.filters).toEqual([['owner_type', 'user'], ['owner_id', 'user-1'], ['concept_key', 'sc.vocab/replace']]);
  });

  it('DELETE ?type removes a whole category; bare DELETE clears only the owner’s cards', async () => {
    const byType = deleteDb();
    mocks.getServerClients.mockResolvedValue({ supabase: byType.supabase, user: null, guestId: 'guest-1' });
    await DELETE(new NextRequest('http://x/api/review-queue?type=restatement'));
    expect(byType.filters).toEqual([['owner_type', 'guest'], ['owner_id', 'guest-1'], ['item_type', 'restatement']]);

    const all = deleteDb();
    mocks.getServerClients.mockResolvedValue({ supabase: all.supabase, user: null, guestId: 'guest-1' });
    await DELETE(new NextRequest('http://x/api/review-queue'));
    expect(all.filters).toEqual([['owner_type', 'guest'], ['owner_id', 'guest-1']]);
  });

  it('DELETE for an unknown question deletes nothing', async () => {
    const db = deleteDb(null);
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'guest-1' });
    await DELETE(new NextRequest('http://x/api/review-queue?questionId=gone'));
    expect(db.from).not.toHaveBeenCalledWith('srs_cards');
  });
});
