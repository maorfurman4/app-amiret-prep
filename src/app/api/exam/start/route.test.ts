import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Question } from '@/types/exam';
import { toCanonicalOption } from '@/lib/option-shuffle';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  planInformativeQuestions: vi.fn(),
  recordSeenQuestions: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/item-selection', () => ({ planInformativeQuestions: mocks.planInformativeQuestions }));
vi.mock('@/lib/question-history', () => ({ recordSeenQuestions: mocks.recordSeenQuestions }));

import { POST } from './route';

/** Four sentence-completion items, correct answer canonically at index 0. */
const questions: Question[] = Array.from({ length: 4 }, (_, i) => ({
  id: `question-${i + 1}`,
  type: 'sentence_completion',
  text: `Question ${i + 1}`,
  options: [0, 1, 2, 3].map(o => ({ id: `${o}`, text: `q${i}-opt${o}` })),
  correct_answer: 0,
  a: 1, b: 0, c: 0.25,
  difficulty_level: 3,
}));

function createSupabase() {
  const single = vi.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return {
    supabase: { from },
    insertedRow: () => insert.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined,
  };
}

function request() {
  return new NextRequest('http://localhost/api/exam/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'full' }),
  });
}

describe('POST /api/exam/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.planInformativeQuestions.mockResolvedValue(questions);
    mocks.recordSeenQuestions.mockResolvedValue(undefined);
  });

  it('serves section 1 with options shuffled per presentation (option_order persisted, canonical key recoverable)', async () => {
    const db = createSupabase();
    mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });

    await POST(request());

    const stored = (db.insertedRow()!.questions_by_section as Record<number, Question[]>)[1];
    expect(stored).toHaveLength(4);
    stored.forEach(q => {
      // Every served question carries a display → canonical permutation…
      expect([...q.option_order!].sort()).toEqual([0, 1, 2, 3]);
      // …and its displayed correct option still maps back to canonical 0.
      expect(toCanonicalOption(q, q.correct_answer)).toBe(0);
      expect(q.options[q.correct_answer].text).toBe(q.options[q.option_order!.indexOf(0)].text);
    });
  });

  it('obeys the anti-clump key and does not pin the answer to one slot across serves', async () => {
    const cap = Math.ceil(4 / 4) + 1; // keyPositions cap for a 4-item, 4-option section
    const seen = new Set<number>();
    for (let run = 0; run < 40; run++) {
      const db = createSupabase();
      mocks.getServerClients.mockResolvedValue({ supabase: db.supabase, user: null, guestId: 'owner-id' });
      await POST(request());
      const stored = (db.insertedRow()!.questions_by_section as Record<number, Question[]>)[1];
      const positions = stored.map(q => q.correct_answer); // display slot of the correct option
      positions.forEach(p => seen.add(p));
      const counts = [0, 0, 0, 0];
      positions.forEach(p => counts[p]++);
      expect(Math.max(...counts)).toBeLessThanOrEqual(cap);      // no clump
      positions.forEach((p, i) => { if (i >= 2) expect(p === positions[i - 1] && p === positions[i - 2]).toBe(false); }); // no 3-in-a-row
    }
    // Across runs the correct answer lands on more than one letter — proof
    // it is no longer stuck at the bank's stored position.
    expect(seen.size).toBeGreaterThan(1);
  });
});
