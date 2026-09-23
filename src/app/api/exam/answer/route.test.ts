import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Question } from '@/types/exam';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  planInformativeQuestions: vi.fn(),
  planInformativePassage: vi.fn(),
  applyResponsesToSrs: vi.fn(),
  calibrateItems: vi.fn(),
  estimateOwnerAbility: vi.fn(),
}));
vi.mock('@/lib/srs', () => ({ applyResponsesToSrs: mocks.applyResponsesToSrs }));
vi.mock('@/lib/calibration-server', () => ({ calibrateItems: mocks.calibrateItems }));
vi.mock('@/lib/ability', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/ability')>()),
  estimateOwnerAbility: mocks.estimateOwnerAbility,
}));

vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/item-selection', () => ({
  planInformativeQuestions: mocks.planInformativeQuestions,
  planInformativePassage: mocks.planInformativePassage,
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
    mocks.planInformativeQuestions.mockResolvedValue(questions);
    mocks.estimateOwnerAbility.mockResolvedValue({ theta: 0.3, n: 40 });
    mocks.calibrateItems.mockResolvedValue({ updated: 0, skipped: null, error: null });
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

  it('commits the next section’s seen-history in the same RPC, never wiping history', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody()));

    expect(response.status).toBe(200);
    expect(db.spies.rpc).toHaveBeenCalledWith('commit_exam_section', expect.objectContaining({
      p_reset_question_ids: [],
      p_reset_passage_history: false,
      p_seen_question_ids: questions.map(question => question.id),
      p_update: expect.objectContaining({ current_section_index: 2 }),
    }));
  });

  it('routes early sections by information at the (EAP) ability estimate, excluding this exam’s items', async () => {
    const db = createSupabase(session({ current_section_expires_at: '2999-01-01T00:00:00.000Z' }));
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    await POST(request(validBody({ answers: [0, 0, 0, 0] }))); // all right on b = 0 items

    const call = mocks.planInformativeQuestions.mock.calls[0][0];
    expect(call).toMatchObject({ type: 'sentence_completion', needed: 4, userKey: 'owner-id', excludeIds: questions.map(q => q.id) });
    // All four right → EAP moves up from 0 but stays finite (MLE would diverge).
    expect(call.theta).toBeGreaterThan(0.3);
    expect(call.theta).toBeLessThan(2);
    const trail = db.getUpdatePayload()!.theta_history as Record<string, unknown>[];
    expect(trail[0]).toMatchObject({ after_section: 1, target_reason: 'ability' });
    expect(trail[0].target_theta).toBeCloseTo(call.theta as number, 10);
  });

  it('decision sections aim at the cut score while the exemption call is uncertain…', async () => {
    // Entering section 5: answers put the student near θ ≈ 1.7.
    const hard = questions.map(q => ({ ...q, b: 1.7, type: 'restatement' as const }));
    const db = createSupabase(session({
      current_section_index: 4,
      questions_by_section: { 4: hard.slice(0, 3) },
      current_section_expires_at: '2999-01-01T00:00:00.000Z',
      section_results: [
        { sectionIndex: 1, questions: hard, answers: [0, 0, 1, 0] },
        { sectionIndex: 2, questions: hard, answers: [0, 1, 0, 0] },
      ],
    }));
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });
    mocks.planInformativeQuestions.mockResolvedValue(hard.slice(0, 3)); // section 5 = 3 restatements

    await POST(request(validBody({ sectionIndex: 4, answers: [0, 1, 0] })));

    expect(mocks.planInformativeQuestions.mock.calls[0][0].theta).toBe(1.7);
    const trail = db.getUpdatePayload()!.theta_history as Record<string, unknown>[];
    expect(trail.at(-1)).toMatchObject({ target_theta: 1.7, target_reason: 'cut_score' });
  });

  it('…but keep measuring a student far from the cut where they actually are', async () => {
    const easy = questions.map(q => ({ ...q, b: -2, type: 'restatement' as const }));
    const db = createSupabase(session({
      current_section_index: 4,
      questions_by_section: { 4: easy.slice(0, 3) },
      current_section_expires_at: '2999-01-01T00:00:00.000Z',
      section_results: [
        { sectionIndex: 1, questions: easy, answers: [1, 1, 1, 0] },
        { sectionIndex: 2, questions: easy, answers: [1, 1, 0, 1] },
      ],
    }));
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });
    mocks.planInformativeQuestions.mockResolvedValue(easy.slice(0, 3));

    await POST(request(validBody({ sectionIndex: 4, answers: [1, 1, 1] })));

    const target = mocks.planInformativeQuestions.mock.calls[0][0].theta as number;
    expect(target).toBeLessThan(0);
    expect((db.getUpdatePayload()!.theta_history as Record<string, unknown>[]).at(-1)).toMatchObject({ target_reason: 'ability' });
  });

  it('routes a reading section to the most informative passage and records it as used', async () => {
    const rc = questions.slice(0, 4).concat(questions[0]).map((q, i) => ({ ...q, id: `rc-${i}`, type: 'reading_comprehension' as const, passage_id: 'passage-9' }));
    mocks.planInformativePassage.mockResolvedValue(rc);
    const db = createSupabase(session({
      current_section_index: 2,
      questions_by_section: { 2: questions },
      used_passage_ids: ['passage-1'],
      current_section_expires_at: '2999-01-01T00:00:00.000Z',
    }));
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    const response = await POST(request(validBody({ sectionIndex: 2 })));

    expect(response.status).toBe(200);
    expect(mocks.planInformativePassage.mock.calls[0][0]).toMatchObject({ userKey: 'owner-id', excludePassageIds: ['passage-1'] });
    expect(db.spies.rpc).toHaveBeenCalledWith('commit_exam_section', expect.objectContaining({ p_seen_passage_id: 'passage-9' }));
    expect(db.getUpdatePayload()!.used_passage_ids).toEqual(['passage-1', 'passage-9']);
  });

  it('fails the transition (503) rather than serving a short section', async () => {
    mocks.planInformativeQuestions.mockResolvedValue(questions.slice(0, 2));
    const db = createSupabase(session({ current_section_expires_at: '2999-01-01T00:00:00.000Z' }));
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });
    expect((await POST(request(validBody()))).status).toBe(503);
    expect(db.spies.rpc).not.toHaveBeenCalled();
  });

  it('at completion records θ’s standard error and P(exempt), and calibrates items against an ability that excludes this exam', async () => {
    const logged = [
      { id: 101, item_id: 'question-1', correct: true, chosen_option: 0, latency_ms: 21000, created_at: '2026-09-23T10:00:00.000Z' },
      { id: 102, item_id: 'question-2', correct: false, chosen_option: 1, latency_ms: 800, created_at: '2026-09-23T10:00:00.000Z' },
    ];
    // Six scored sections behind it, as in any real exam.
    const scored = [1, 2, 3, 4, 5, 6].map(sectionIndex => ({ sectionIndex, questions, answers: [0, 1, 0, 0] }));
    const db = createSupabase(
      session({ current_section_index: 7, questions_by_section: { 7: questions }, section_results: scored, current_section_expires_at: '2999-01-01T00:00:00.000Z' }),
      { data: true, error: null },
      logged,
    );
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: { id: 'account-id' } });
    mocks.applyResponsesToSrs.mockResolvedValue({ created: 0, reviewed: 0, cleared: 0, error: null });

    await POST(request(validBody({ sectionIndex: 7 })));

    const payload = db.getUpdatePayload()!;
    // 24 scored items at b = 0 answered 75% right: θ̂ well above 0, SE from their information.
    expect(payload.theta_se as number).toBeGreaterThan(0.2);
    expect(payload.theta_se as number).toBeLessThan(0.6);
    // θ̂ sits well below the 1.7 cut → exemption unlikely but not impossible.
    expect(payload.p_exempt as number).toBeGreaterThan(0);
    expect(payload.p_exempt as number).toBeLessThan(0.2);
    expect(mocks.estimateOwnerAbility).toHaveBeenCalledWith(db.supabase, { id: 'account-id', type: 'user' }, { excludeSessionId: 'session-id' });
    expect(mocks.calibrateItems).toHaveBeenCalledWith(db.supabase, { theta: 0.3, n: 40 }, [
      { responseId: 101, type: 'sentence_completion', latencyMs: 21000 },
      { responseId: 102, type: 'sentence_completion', latencyMs: 800 },
    ]);
  });
});
