import { describe, expect, it, vi } from 'vitest';
import { buildRCQuestions, fetchUnseenQuestions, planUnseenQuestions } from './question-history';

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

// ── Cross-session dedup ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/** Longest `.in()` list that fits in a request; production fails past ~600 ids. */
const MAX_IN_IDS = 200;
/** PostgREST's default max rows per response. */
const ROW_CAP = 1000;

/**
 * In-memory PostgREST stand-in for `questions` and `user_question_history`.
 * Like production, a `.in()` list too long for one request fails (the
 * request errors out and `data` is null), and a response is capped at 1000 rows.
 */
function store(tables: Record<string, Row[]>) {
  const requests: { table: string; op: string; inSize: number }[] = [];
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op = 'select';
    let inSize = 0;
    let range: [number, number] | null = null;
    const run = () => {
      requests.push({ table, op, inSize });
      if (inSize > MAX_IN_IDS) return { data: null, error: { message: 'fetch failed' } };
      const rows = tables[table].filter(r => filters.every(f => f(r)));
      if (op === 'delete') {
        tables[table] = tables[table].filter(r => !rows.includes(r));
        return { data: null, error: null };
      }
      const [lo, hi] = range ?? [0, ROW_CAP - 1];
      return { data: rows.slice(lo, Math.min(hi, lo + ROW_CAP - 1) + 1), error: null };
    };
    const b = {
      select: () => b,
      delete: () => { op = 'delete'; return b; },
      eq: (col: string, v: unknown) => { filters.push(r => r[col] === v); return b; },
      in: (col: string, vs: unknown[]) => { inSize = Math.max(inSize, vs.length); filters.push(r => vs.includes(r[col])); return b; },
      order: () => b,
      range: (lo: number, hi: number) => { range = [lo, hi]; return b; },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return b;
  };
  return { supabase: { from } as never, tables, requests };
}

/** A type+level pool the size of production's largest (~610), plus history. */
function bank({ pool = 600, seen = 0, otherSeen = 0 } = {}) {
  const questions = Array.from({ length: pool }, (_, i) => ({
    id: `q${i}`, type: 'sentence_completion', difficulty_level: 3, active: true,
    options: [{ text: `w${i}a` }, { text: `w${i}b` }, { text: `w${i}c` }, { text: `w${i}d` }],
  }));
  const history = [
    ...questions.slice(0, seen).map(q => ({ user_key: 'u1', question_id: q.id })),
    // Other questions this user has seen (other types/levels) — enough to pass a page.
    ...Array.from({ length: otherSeen }, (_, i) => ({ user_key: 'u1', question_id: `other${i}` })),
    // Someone else's history must never count.
    ...questions.slice(seen).map(q => ({ user_key: 'u2', question_id: q.id })),
  ];
  return store({ questions, user_question_history: history });
}

const args = { userKey: 'u1', type: 'sentence_completion', difficultyLevel: 3 };

describe('planUnseenQuestions — cross-session dedup', () => {
  it('never serves a question the user has already seen', async () => {
    // 596 of 600 seen: only q596–q599 are left.
    for (let run = 0; run < 20; run++) {
      const s = bank({ seen: 596 });
      const plan = await planUnseenQuestions({ supabase: s.supabase, ...args, needed: 4 });
      expect(plan.questions.map(q => q.id).sort()).toEqual(['q596', 'q597', 'q598', 'q599']);
      expect(plan.resetQuestionIds).toEqual([]);
    }
  });

  it('reads history by user_key, never with the pool as an id list', async () => {
    const s = bank({ seen: 10 });
    await planUnseenQuestions({ supabase: s.supabase, ...args, needed: 4 });
    const historyReads = s.requests.filter(r => r.table === 'user_question_history');
    expect(historyReads.length).toBeGreaterThan(0);
    expect(historyReads.every(r => r.inSize === 0)).toBe(true);
  });

  it('sees history past the 1000-row page', async () => {
    const s = bank({ seen: 596, otherSeen: 1500 });
    const plan = await planUnseenQuestions({ supabase: s.supabase, ...args, needed: 4 });
    expect(plan.questions.map(q => q.id).sort()).toEqual(['q596', 'q597', 'q598', 'q599']);
  });

  it('keeps the requested count and distinct options', async () => {
    const s = bank({ seen: 100 });
    const plan = await planUnseenQuestions({ supabase: s.supabase, ...args, needed: 10 });
    expect(plan.questions).toHaveLength(10);
    const words = plan.questions.flatMap(q => (q.options ?? []).map(o => o.text));
    expect(new Set(words).size).toBe(words.length);
  });

  it('plans a reset of the whole pool once fewer unseen than needed remain', async () => {
    const s = bank({ seen: 598 });
    const plan = await planUnseenQuestions({ supabase: s.supabase, ...args, needed: 4 });
    expect(plan.questions).toHaveLength(4);
    expect(plan.resetQuestionIds).toHaveLength(600);
  });

  it('does not plan a reset for a user with no history in the pool', async () => {
    const s = bank({ seen: 0 });
    const plan = await planUnseenQuestions({ supabase: s.supabase, ...args, needed: 4 });
    expect(plan.resetQuestionIds).toEqual([]);
  });
});

describe('fetchUnseenQuestions — reset on exhaustion', () => {
  it('clears the exhausted pool from this user\'s history only', async () => {
    const s = bank({ seen: 598, otherSeen: 5 });
    const qs = await fetchUnseenQuestions({ supabase: s.supabase, ...args, needed: 4 });
    expect(qs).toHaveLength(4);
    const left = s.tables.user_question_history;
    expect(left.filter(r => r.user_key === 'u1').map(r => r.question_id).sort())
      .toEqual(['other0', 'other1', 'other2', 'other3', 'other4']);
    expect(left.filter(r => r.user_key === 'u2')).toHaveLength(2);
  });
});
