import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  planInformativeQuestions: vi.fn(),
  recordSeenQuestions: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/item-selection', () => ({ planInformativeQuestions: mocks.planInformativeQuestions }));
vi.mock('@/lib/question-history', () => ({ recordSeenQuestions: mocks.recordSeenQuestions }));

import { POST } from './route';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function row(n: number) {
  return { id: uuid(n), type: n % 2 ? 'sentence_completion' : 'restatement', b: 0, c: 0.25, b_calibrated: null, correct_answer: 0 };
}

const nextQuestion = {
  id: uuid(99), type: 'sentence_completion', text: 'Q', correct_answer: 0, b: 0, c: 0.25, difficulty_level: 3,
  options: [0, 1, 2, 3].map(o => ({ id: `${o}`, text: `Option ${o}` })),
};

function client(rows: ReturnType<typeof row>[], user: { id: string } | null = { id: 'user-1' }) {
  const query = { select: vi.fn(() => query), in: vi.fn(async () => ({ data: rows, error: null })) };
  mocks.getServerClients.mockResolvedValue({ supabase: { from: vi.fn(() => query) }, user, guestId: null });
}

function request(body: unknown) {
  return new NextRequest('http://localhost/api/diagnostic/next', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/diagnostic/next', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.planInformativeQuestions.mockResolvedValue([nextQuestion]);
  });

  it('serves the most informative sentence-completion item at θ = 0 to start', async () => {
    client([]);
    const res = await POST(request({ answers: [] }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.done).toBe(false);
    expect(body.question.id).toBe(uuid(99));
    expect(body.question.option_order).toHaveLength(4);
    expect(mocks.planInformativeQuestions).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sentence_completion', theta: expect.closeTo(0, 6), needed: 1, excludeIds: [],
    }));
    expect(mocks.recordSeenQuestions).toHaveBeenCalledWith(expect.anything(), 'user-1', [uuid(99)]);
  });

  it('scores answers from stored parameters and excludes answered items', async () => {
    client([row(1)]);
    await POST(request({ answers: [{ id: uuid(1), chosen: 0 }] }));
    const call = mocks.planInformativeQuestions.mock.calls[0][0];
    expect(call.type).toBe('restatement');
    expect(call.theta).toBeGreaterThan(0);
    expect(call.excludeIds).toEqual([uuid(1)]);
  });

  it('returns the start plan once the stopping rule fires', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(i + 1));
    client(rows);
    const res = await POST(request({ answers: rows.map(r => ({ id: r.id, chosen: 0 })) }));
    const body = await res.json();
    expect(body.done).toBe(true);
    expect(body.plan.primary.href).toMatch(/^\/practice\?type=/);
    expect(mocks.planInformativeQuestions).not.toHaveBeenCalled();
  });

  it('rejects unknown, duplicate, or out-of-scope items', async () => {
    client([]);
    expect((await POST(request({ answers: [{ id: uuid(1), chosen: 0 }] }))).status).toBe(400);
    client([row(1)]);
    expect((await POST(request({ answers: [{ id: uuid(1), chosen: 0 }, { id: uuid(1), chosen: 1 }] }))).status).toBe(400);
    client([{ ...row(1), type: 'reading_comprehension' }]);
    expect((await POST(request({ answers: [{ id: uuid(1), chosen: 0 }] }))).status).toBe(400);
  });

  it('requires an identity', async () => {
    client([], null);
    expect((await POST(request({ answers: [] }))).status).toBe(401);
  });
});
