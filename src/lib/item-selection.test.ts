import { describe, expect, it, vi } from 'vitest';
import { CANDIDATE_FACTOR, planInformativeQuestions } from './item-selection';

vi.mock('@/lib/question-history', () => ({ buildRCQuestions: vi.fn() }));

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
