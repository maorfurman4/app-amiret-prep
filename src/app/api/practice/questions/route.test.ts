import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Question } from '@/types/exam';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  fetchUnseenQuestions: vi.fn(),
  fetchUnseenRCQuestions: vi.fn(),
  recordSeenQuestions: vi.fn(),
  recordSeenPassage: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
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
