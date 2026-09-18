import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Question } from '@/types/exam';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  planUnseenQuestions: vi.fn(),
  planUnseenRCQuestions: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/question-history', () => ({
  planUnseenQuestions: mocks.planUnseenQuestions,
  planUnseenRCQuestions: mocks.planUnseenRCQuestions,
}));

import { POST } from './route';

const questions: Question[] = Array.from({ length: 4 }, (_, index) => ({
  id: `question-${index + 1}`,
  type: 'sentence_completion',
  text: `Question ${index + 1}`,
  options: [0, 1, 2, 3].map(option => ({ id: `${option}`, text: `Option ${option}` })),
  correct_answer: 0,
  a: 1,
  b: 0,
  c: 0.25,
  difficulty_level: 3,
}));

function request(body: unknown) {
  return new NextRequest('http://localhost/api/exam/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-id',
    user_id: 'owner-id',
    completed_at: null,
    current_section_index: 1,
    current_section_expires_at: '2026-09-16T10:00:00.000Z',
    theta: 0,
    theta_history: [],
    section_results: [],
    answers_by_section: {},
    questions_by_section: { 1: questions },
    used_question_ids: questions.map(question => question.id),
    used_passage_ids: [],
    is_practice: false,
    ...overrides,
  };
}

function createSupabase(
  sessionResult = session(),
  updateResult: { data: boolean; error: unknown } = { data: true, error: null },
) {
  const fetchEq = vi.fn();
  const fetchSingle = vi.fn().mockResolvedValue({ data: sessionResult, error: null });
  const fetchChain = { eq: fetchEq, single: fetchSingle };
  fetchEq.mockReturnValue(fetchChain);

  const select = vi.fn().mockReturnValue(fetchChain);
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue(updateResult);

  return {
    supabase: { from, rpc },
    spies: { from, fetchEq, rpc },
    getUpdatePayload: () => rpc.mock.calls[0]?.[1]?.p_update as Record<string, unknown> | undefined,
  };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-id',
    sectionIndex: 1,
    answers: [0, 1, 2, 3],
    guestId: 'owner-id',
    ...overrides,
  };
}

describe('POST /api/exam/answer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.planUnseenQuestions.mockResolvedValue({ questions, resetQuestionIds: [] });
  });

  it('rejects an answer list that does not match the section', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody({ answers: [0, 1] })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid answers length' });
    expect(db.spies.rpc).not.toHaveBeenCalled();
  });

  it('scores every late answer as unanswered before advancing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:21.000Z'));
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody()));
    const payload = db.getUpdatePayload();

    expect(response.status).toBe(200);
    expect((await response.json()).lateSubmission).toBe(true);
    expect(payload?.answers_by_section).toEqual({ 1: [null, null, null, null] });
    expect(payload?.section_results).toEqual([
      expect.objectContaining({ answers: [null, null, null, null], correctCount: 0 }),
    ]);
    vi.useRealTimers();
  });

  it('returns a conflict when another request already advanced the section', async () => {
    const db = createSupabase(session(), { data: false, error: null });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody()));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Section already submitted' });
    expect(db.spies.rpc).toHaveBeenCalledWith('commit_exam_section', expect.objectContaining({
      p_section_index: 1,
      p_owner_id: 'owner-id',
    }));
  });

  it('uses the authenticated owner instead of a supplied guest id', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({
      supabase: db.supabase,
      user: { id: 'authenticated-owner' },
    });

    const response = await POST(request(validBody({ guestId: 'another-account' })));

    expect(response.status).toBe(200);
    expect(db.spies.fetchEq).toHaveBeenNthCalledWith(1, 'id', 'session-id');
    expect(db.spies.fetchEq).toHaveBeenNthCalledWith(2, 'user_id', 'authenticated-owner');
  });

  it('commits question-history changes in the same RPC as the section', async () => {
    const db = createSupabase();
    mocks.planUnseenQuestions.mockResolvedValue({
      questions,
      resetQuestionIds: ['old-question-id'],
    });
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody()));

    expect(response.status).toBe(200);
    expect(db.spies.rpc).toHaveBeenCalledWith('commit_exam_section', expect.objectContaining({
      p_reset_question_ids: ['old-question-id'],
      p_seen_question_ids: questions.map(question => question.id),
      p_update: expect.objectContaining({ current_section_index: 2 }),
    }));
  });
});
