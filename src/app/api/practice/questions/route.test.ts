import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Question } from '@/types/exam';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  fetchUnseenQuestions: vi.fn(),
  fetchUnseenRCQuestions: vi.fn(),
  recordSeenQuestions: vi.fn(),
  recordSeenPassage: vi.fn(),
  fetchMixedSingles: vi.fn(),
  fetchMixedPassages: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/mixed-practice-server', () => ({
  fetchMixedSingles: mocks.fetchMixedSingles,
  fetchMixedPassages: mocks.fetchMixedPassages,
}));
vi.mock('@/lib/question-history', () => ({
  fetchUnseenQuestions: mocks.fetchUnseenQuestions,
  fetchUnseenRCQuestions: mocks.fetchUnseenRCQuestions,
  recordSeenQuestions: mocks.recordSeenQuestions,
  recordSeenPassage: mocks.recordSeenPassage,
}));

import { GET } from './route';

const bank: Question[] = Array.from({ length: 5 }, (_, n) => ({
  id: `q${n}`,
  type: 'sentence_completion',
  text: `Q${n}`,
  options: ['w', 'x', 'y', 'z'].map((t, i) => ({ id: 'abcd'[i], text: `${t}${n}` })),
  correct_answer: n % 4,
  a: 1.2, b: 0, c: 0.25, difficulty_level: 3,
}));

describe('GET /api/practice/questions — option shuffling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerClients.mockResolvedValue({ supabase: {}, user: null, guestId: 'guest-1' });
    mocks.fetchUnseenQuestions.mockResolvedValue(bank);
  });

  it('serves every question with a permutation that keeps the key on the same option', async () => {
    const res = await GET(new NextRequest('http://localhost/api/practice/questions?type=sentence_completion&difficulty=3&count=5'));
    const { questions } = await res.json() as { questions: (Question & { option_order: number[] })[] };

    expect(questions).toHaveLength(5);
    questions.forEach(served => {
      const original = bank.find(q => q.id === served.id)!;
      expect([...served.option_order].sort()).toEqual([0, 1, 2, 3]);
      expect(served.options[served.correct_answer]).toEqual(original.options[original.correct_answer]);
    });
  });

  it('reshuffles on every request', async () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const res = await GET(new NextRequest('http://localhost/api/practice/questions?type=sentence_completion&difficulty=3&count=5'));
      const { questions } = await res.json() as { questions: { option_order: number[] }[] };
      orders.add(questions.map(q => q.option_order.join('')).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('GET /api/practice/questions — mixed', () => {
  const mk = (id: string, type: Question['type'], extra: Partial<Question> = {}): Question =>
    ({ ...bank[0], id, type, options: bank[0].options.map(o => ({ ...o, text: `${o.text}-${id}` })), ...extra });
  const singlesFor = (sc: number, rs: number) => new Map<Question['type'], Question[]>([
    ['sentence_completion', Array.from({ length: sc }, (_, i) => mk(`s${i}`, 'sentence_completion'))],
    ['restatement', Array.from({ length: rs }, (_, i) => mk(`r${i}`, 'restatement'))],
  ]);
  const passage = (pid: string) => Array.from({ length: 5 }, (_, i) => mk(`${pid}-${i}`, 'reading_comprehension', { passage_id: pid }));
  const get = (q: string) => GET(new NextRequest(`http://localhost/api/practice/questions?type=mixed&difficulty=3${q}`));

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerClients.mockResolvedValue({ supabase: {}, user: null, guestId: 'guest-1' });
  });

  it('serves exactly the requested mix, the passage as one block in order', async () => {
    mocks.fetchMixedSingles.mockResolvedValue(singlesFor(4, 3));
    mocks.fetchMixedPassages.mockResolvedValue([passage('p1')]);
    const res = await get('&sc=4&rs=3&rc=1');
    const body = await res.json() as { questions: Question[]; mix: unknown };

    expect(mocks.fetchMixedSingles).toHaveBeenCalledWith(expect.objectContaining({
      levels: [3],
      requests: [{ type: 'sentence_completion', needed: 4 }, { type: 'restatement', needed: 3 }],
    }));
    expect(mocks.fetchMixedPassages).toHaveBeenCalledWith(expect.objectContaining({ levels: [3] }));
    const ids = body.questions.map(q => q.id);
    expect(ids).toHaveLength(12);
    const start = ids.indexOf('p1-0');
    expect(ids.slice(start, start + 5)).toEqual(['p1-0', 'p1-1', 'p1-2', 'p1-3', 'p1-4']);
    expect(body.mix).toEqual({ requested: { sc: 4, rs: 3, rc: 1 }, served: { sc: 4, rs: 3, rc: 1 } });
  });

  it('uses the exam-scaled default when no per-type counts are sent', async () => {
    mocks.fetchMixedSingles.mockResolvedValue(singlesFor(6, 3));
    mocks.fetchMixedPassages.mockResolvedValue([passage('p1')]);
    const body = await (await get('&count=10')).json() as { questions: Question[] };
    expect(body.questions).toHaveLength(14);
  });

  it('spreads "random" across all levels and draws a level per passage', async () => {
    mocks.fetchMixedSingles.mockResolvedValue(singlesFor(2, 0));
    mocks.fetchMixedPassages.mockResolvedValue([passage('p1'), passage('p2')]);
    await GET(new NextRequest('http://localhost/api/practice/questions?type=mixed&difficulty=random&sc=2&rs=0&rc=2'));
    expect(mocks.fetchMixedSingles.mock.calls[0][0].levels).toEqual([1, 2, 3, 4, 5]);
    const levels = mocks.fetchMixedPassages.mock.calls[0][0].levels as number[];
    expect(levels).toHaveLength(2);
    levels.forEach(l => expect(l).toBeGreaterThanOrEqual(1));
  });

  it('reports a short pool instead of failing', async () => {
    mocks.fetchMixedSingles.mockResolvedValue(singlesFor(4, 1));
    mocks.fetchMixedPassages.mockResolvedValue([]);
    const res = await get('&sc=4&rs=3&rc=1');
    expect(res.status).toBe(200);
    const body = await res.json() as { questions: Question[]; mix: unknown };
    expect(body.questions).toHaveLength(5);
    expect(body.mix).toEqual({ requested: { sc: 4, rs: 3, rc: 1 }, served: { sc: 4, rs: 1, rc: 0 } });
  });

  it('404s only when nothing at all was found', async () => {
    mocks.fetchMixedSingles.mockResolvedValue(singlesFor(0, 0));
    mocks.fetchMixedPassages.mockResolvedValue([]);
    expect((await get('&sc=2&rs=0&rc=0')).status).toBe(404);
  });

  it('rejects an empty mix and one over the cap without touching the database', async () => {
    expect((await get('&sc=0&rs=0&rc=0')).status).toBe(400);
    expect((await get('&sc=12&rs=12&rc=2')).status).toBe(400);
    expect(mocks.fetchMixedSingles).not.toHaveBeenCalled();
  });

  it('records seen questions and passages — unless deferSeen is set', async () => {
    mocks.fetchMixedSingles.mockResolvedValue(singlesFor(2, 1));
    mocks.fetchMixedPassages.mockResolvedValue([passage('p1')]);
    await get('&sc=2&rs=1&rc=1');
    expect(mocks.recordSeenQuestions).toHaveBeenCalledWith({}, 'guest-1', ['s0', 's1', 'r0']);
    expect(mocks.recordSeenPassage).toHaveBeenCalledWith({}, 'guest-1', 'p1');

    vi.clearAllMocks();
    await get('&sc=2&rs=1&rc=1&deferSeen=1');
    expect(mocks.recordSeenQuestions).not.toHaveBeenCalled();
    expect(mocks.recordSeenPassage).not.toHaveBeenCalled();
  });
});
