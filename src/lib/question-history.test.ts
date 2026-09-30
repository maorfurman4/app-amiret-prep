import { describe, expect, it, vi } from 'vitest';
import { buildRCQuestions } from './question-history';

vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }));

// Records every filter the query builder receives.
function db(rows: { id: string }[] = []) {
  const calls: [string, ...unknown[]][] = [];
  const builder = {
    select: (...a: unknown[]) => { calls.push(['select', ...a]); return builder; },
    eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return builder; },
    order: (...a: unknown[]) => { calls.push(['order', ...a]); return builder; },
    limit: (...a: unknown[]) => { calls.push(['limit', ...a]); return Promise.resolve({ data: rows }); },
  };
  return { supabase: { from: () => builder } as never, calls };
}

const passage = { id: 'p1', text: 'text', difficulty_level: 3, b: 0 };

describe('buildRCQuestions', () => {
  it('never serves a retired question, in a stable order', async () => {
    const d = db();
    await buildRCQuestions(d.supabase, passage);
    expect(d.calls).toContainEqual(['eq', 'active', true]);
    expect(d.calls.some(c => c[0] === 'order' && c[1] === 'id')).toBe(true);
  });

  it('keeps exam-excluded questions out of the exam only', async () => {
    const practice = db();
    await buildRCQuestions(practice.supabase, passage);
    expect(practice.calls).not.toContainEqual(['eq', 'exam_eligible', true]);

    const exam = db();
    await buildRCQuestions(exam.supabase, passage, { examOnly: true });
    expect(exam.calls).toContainEqual(['eq', 'exam_eligible', true]);
  });

  it('attaches the passage to every question', async () => {
    const d = db([{ id: 'q1' }, { id: 'q2' }]);
    const qs = await buildRCQuestions(d.supabase, passage);
    expect(qs.map(q => q.passage?.id)).toEqual(['p1', 'p1']);
  });
});
