import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { DELETE } from './route';

function request(sessionId = 'exam') {
  return new NextRequest(`http://localhost/api/exam/state?sessionId=${sessionId}`);
}

function setup(sessionRow: unknown) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  const questionHistoryChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  const passageHistoryChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  const sessionSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: sessionRow }),
  };
  const sessionDeleteChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ error: null }),
  };

  let sessionCallCount = 0;
  const from = vi.fn((table: string) => {
    calls.push({ table, method: 'from', args: [] });
    if (table === 'exam_sessions') {
      sessionCallCount++;
      return sessionCallCount === 1 ? sessionSelectChain : sessionDeleteChain;
    }
    if (table === 'user_question_history') return questionHistoryChain;
    if (table === 'user_passage_history') return passageHistoryChain;
    throw new Error(`unexpected table ${table}`);
  });

  return { supabase: { from }, spies: { from, questionHistoryChain, passageHistoryChain } };
}

describe('DELETE /api/exam/state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rolls back seen-history for the current section only, not completed ones', async () => {
    const db = setup({
      current_section_index: 2,
      questions_by_section: {
        1: [{ id: 'q1' }, { id: 'q2' }],
        2: [{ id: 'q3' }, { id: 'q4', passage_id: 'p1' }],
      },
    });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'owner' } });

    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(db.spies.questionHistoryChain.in).toHaveBeenCalledWith('question_id', ['q3', 'q4']);
    expect(db.spies.passageHistoryChain.in).toHaveBeenCalledWith('passage_id', ['p1']);
  });

  it('does nothing extra when the session is already gone', async () => {
    const db = setup(null);
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'owner' } });

    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(db.spies.questionHistoryChain.delete).not.toHaveBeenCalled();
    expect(db.spies.passageHistoryChain.delete).not.toHaveBeenCalled();
  });

  it('requires an owner', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: { from: vi.fn() }, user: null, guestId: null });
    const response = await DELETE(request());
    expect(response.status).toBe(401);
  });
});
