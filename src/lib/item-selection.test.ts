import { describe, expect, it, vi } from 'vitest';
import { CANDIDATE_FACTOR, planInformativePassage, planInformativeQuestions } from './item-selection';
import { buildRCQuestions } from '@/lib/question-history';

vi.mock('@/lib/question-history', () => ({ buildRCQuestions: vi.fn().mockResolvedValue([]) }));

const opts = (...t: string[]) => t.map(text => ({ text }));
// Ranked candidates as the RPC returns them: three from one templated batch first.
const rows = [
  { id: 'composed', options: opts('trivial', 'vague', 'frugal', 'composed') },
  { id: 'profound', options: opts('profound', 'trivial', 'frugal', 'vague') },
  { id: 'insufficient', options: opts('frugal', 'genuine', 'eloquent', 'insufficient') },
  { id: 'c1', options: opts('expand', 'reduce', 'ignore', 'predict') },
  { id: 'c2', options: opts('reluctant', 'eager', 'curious', 'hostile') },
  { id: 'c3', options: opts('abandon', 'adapt', 'assess', 'assume') },
];

function db() {
  const rpc = vi.fn().mockResolvedValue({ data: rows.map(r => ({ question_id: r.id })), error: null });
  const from = vi.fn(() => ({ select: () => ({ in: () => Promise.resolve({ data: [...rows].reverse() }) }) }));
  return { supabase: { rpc, from } as never, rpc };
}

describe('planInformativeQuestions', () => {
  it('draws extra candidates and returns a section with no shared answer choices', async () => {
    const d = db();
    const section = await planInformativeQuestions({ supabase: d.supabase, userKey: 'u', type: 'sentence_completion', theta: 0, needed: 4 });
    expect(d.rpc.mock.calls[0][1]).toMatchObject({ p_needed: 4 * CANDIDATE_FACTOR, p_pool: 4 * CANDIDATE_FACTOR });
    expect(section.map(q => q.id)).toEqual(['composed', 'c1', 'c2', 'c3']);
  });

  it('avoids choices already shown in earlier sections', async () => {
    const d = db();
    const section = await planInformativeQuestions({
      supabase: d.supabase, userKey: 'u', type: 'sentence_completion', theta: 0, needed: 2, avoidWords: ['frugal', 'expand'],
    });
    expect(section.map(q => q.id)).toEqual(['c2', 'c3']);
  });
});

describe('planInformativePassage', () => {
  it('builds the exam passage from exam-eligible questions only', async () => {
    const passage = { id: 'p1', text: 't', difficulty_level: 3, b: 0 };
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: 'p1', error: null }),
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: passage }) }) }) }),
    } as never;
    await planInformativePassage({ supabase, userKey: 'u', theta: 0 });
    expect(vi.mocked(buildRCQuestions)).toHaveBeenCalledWith(supabase, passage, { examOnly: true });
  });
});
