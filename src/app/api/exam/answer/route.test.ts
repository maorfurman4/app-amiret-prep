import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Question } from '@/types/exam';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  planUnseenQuestions: vi.fn(),
  planUnseenRCQuestions: vi.fn(),
  applyResponsesToSrs: vi.fn(),
}));
vi.mock('@/lib/srs', () => ({ applyResponsesToSrs: mocks.applyResponsesToSrs }));

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
  loggedResponses: Record<string, unknown>[] = [],
) {
  const fetchEq = vi.fn();
  const fetchSingle = vi.fn().mockResolvedValue({ data: sessionResult, error: null });
  const fetchChain = { eq: fetchEq, single: fetchSingle };
  fetchEq.mockReturnValue(fetchChain);

  const select = vi.fn().mockReturnValue(fetchChain);
  const responsesEq = vi.fn().mockResolvedValue({ data: loggedResponses, error: null });
  const from = vi.fn((table: string) => (table === 'responses'
    ? { select: () => ({ eq: responsesEq }) }
    : { select }));
  const rpc = vi.fn().mockResolvedValue(updateResult);

  return {
    supabase: { from, rpc },
    spies: { from, fetchEq, rpc, responsesEq },
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

  it('returns a conflict (not a bad request) for a stale resubmit whose section already advanced', async () => {
    // The session has already moved to section 2 (e.g. an earlier attempt
    // of this exact submission actually succeeded, and the client is now
    // retrying with its now-stale sectionIndex) — 409, same "resync"
    // treatment as the RPC-level conflict above, not 400 (which the client
    // shows as a scary "your answers failed to send" error for what is
    // actually a harmless, already-saved submission).
    const db = createSupabase(session({ current_section_index: 2 }));
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody({ sectionIndex: 1 })));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Section mismatch' });
    expect(db.spies.rpc).not.toHaveBeenCalled();
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

  it('logs every question of the section in the same RPC, graded, with ms latency', async () => {
    const db = createSupabase(session({ theta: 0.7, current_section_expires_at: '2999-01-01T00:00:00.000Z' }));
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody({ answers: [0, 1, null, 0], timings: [12.345, 40, 3.2, 0] })));

    expect(response.status).toBe(200);
    const rows = db.spies.rpc.mock.calls[0][1].p_responses;
    // θ = 0.7 vs b = 0 under the baseline a = 1.2, c = .25.
    const p = expect.closeTo(0.25 + 0.75 / (1 + Math.exp(-1.2 * 0.7)), 6);
    expect(rows).toEqual([
      { owner_type: 'guest', item_id: 'question-1', context: 'exam', correct: true, chosen_option: 0, latency_ms: 12345, theta_before: 0.7, p_correct: p, section_index: 1 },
      { owner_type: 'guest', item_id: 'question-2', context: 'exam', correct: false, chosen_option: 1, latency_ms: 40000, theta_before: 0.7, p_correct: p, section_index: 1 },
      { owner_type: 'guest', item_id: 'question-3', context: 'exam', correct: false, chosen_option: null, latency_ms: 3200, theta_before: 0.7, p_correct: p, section_index: 1 },
      { owner_type: 'guest', item_id: 'question-4', context: 'exam', correct: true, chosen_option: 0, latency_ms: 0, theta_before: 0.7, p_correct: p, section_index: 1 },
    ]);
    // Section results still carry whole seconds for the pacing display.
    expect(db.getUpdatePayload()?.section_results).toEqual([
      expect.objectContaining({ timings: [12, 40, 3, 0] }),
    ]);
  });

  it('logs a late section as the blanks it was scored as, and practice exams as practice', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:21.000Z'));
    const late = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: late.supabase, user: { id: 'account-id' } });
    await POST(request(validBody()));
    vi.useRealTimers();
    const lateRows = late.spies.rpc.mock.calls[0][1].p_responses;
    expect(lateRows).toHaveLength(4);
    lateRows.forEach((row: Record<string, unknown>) => {
      expect(row).toMatchObject({ owner_type: 'user', chosen_option: null, correct: false, latency_ms: null });
    });

    const practice = createSupabase(session({ is_practice: true }));
    mocks.getServerClients.mockResolvedValue({ supabase: practice.supabase, user: null, guestId: 'owner-id' });
    await POST(request(validBody()));
    expect(practice.spies.rpc.mock.calls[0][1].p_responses.every((r: { context: string }) => r.context === 'practice')).toBe(true);
  });

  it('does not schedule spaced repetition mid-exam', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });
    await POST(request(validBody()));
    expect(mocks.applyResponsesToSrs).not.toHaveBeenCalled();
    expect(db.spies.rpc.mock.calls[0][1].p_wrong_question_ids).toEqual([]);
  });

  it('at completion, feeds every logged exam answer (right and wrong) to FSRS with its real latency and time', async () => {
    const logged = [
      { item_id: 'question-1', correct: true, chosen_option: 0, latency_ms: 21000, created_at: '2026-09-23T10:00:00.000Z' },
      { item_id: 'question-2', correct: false, chosen_option: null, latency_ms: 64000, created_at: '2026-09-23T10:00:00.000Z' },
    ];
    const db = createSupabase(
      session({ current_section_index: 7, questions_by_section: { 7: questions }, current_section_expires_at: '2999-01-01T00:00:00.000Z' }),
      { data: true, error: null },
      logged,
    );
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'account-id' } });
    mocks.applyResponsesToSrs.mockResolvedValue({ created: 1, reviewed: 0, cleared: 0, error: null });

    const response = await POST(request(validBody({ sectionIndex: 7 })));

    expect(response.status).toBe(200);
    expect((await response.json()).isComplete).toBe(true);
    expect(db.spies.responsesEq).toHaveBeenCalledWith('session_id', 'session-id');
    expect(mocks.applyResponsesToSrs).toHaveBeenCalledWith(db.supabase, { id: 'account-id', type: 'user' }, [
      { itemId: 'question-1', correct: true, answered: true, latencyMs: 21000, at: new Date('2026-09-23T10:00:00.000Z') },
      { itemId: 'question-2', correct: false, answered: false, latencyMs: 64000, at: new Date('2026-09-23T10:00:00.000Z') },
    ]);
  });

  it('a scheduling failure never un-completes an already committed exam', async () => {
    const db = createSupabase(
      session({ current_section_index: 7, questions_by_section: { 7: questions }, current_section_expires_at: '2999-01-01T00:00:00.000Z' }),
    );
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });
    mocks.applyResponsesToSrs.mockRejectedValue(new Error('boom'));
    const response = await POST(request(validBody({ sectionIndex: 7 })));
    expect(response.status).toBe(200);
    expect((await response.json()).isComplete).toBe(true);
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
