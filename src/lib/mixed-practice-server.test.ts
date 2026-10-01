import { describe, expect, it } from 'vitest';
import type { Question } from '@/types/exam';
import { fetchMixedSingles, fetchMixedPassages } from './mixed-practice-server';

type Row = Record<string, unknown>;
type Call = { table: string; op: 'select' | 'delete'; filters: [string, string, unknown][] };

/**
 * A minimal in-memory stand-in for the Supabase query builder: enough of
 * select/eq/in/not-in/order/range/limit/delete to run the helpers, and a log
 * of every request so tests can check what was (and wasn't) asked for.
 */
function fakeSupabase(tables: Record<string, Row[]>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    let range: [number, number] | null = null;
    let limit: number | null = null;
    const run = () => {
      calls.push(call);
      const match = (r: Row) => call.filters.every(([kind, col, v]) =>
        kind === 'eq' ? r[col] === v
        : kind === 'in' ? (v as unknown[]).includes(r[col])
        : !(String(v).slice(1, -1).split(',').includes(String(r[col]))));
      if (call.op === 'delete') {
        tables[table] = (tables[table] ?? []).filter(r => !match(r));
        return { data: null, error: null };
      }
      let rows = (tables[table] ?? []).filter(match);
      if (range) rows = rows.slice(range[0], range[1] + 1);
      if (limit !== null) rows = rows.slice(0, limit);
      return { data: rows, error: null };
    };
    const b = {
      select: () => b,
      delete: () => { call.op = 'delete'; return b; },
      eq: (col: string, v: unknown) => { call.filters.push(['eq', col, v]); return b; },
      in: (col: string, v: unknown[]) => { call.filters.push(['in', col, v]); return b; },
      not: (col: string, _op: string, v: string) => { call.filters.push(['notin', col, v]); return b; },
      order: () => b,
      range: (a: number, z: number) => { range = [a, z]; return b; },
      limit: (n: number) => { limit = n; return b; },
      then: (res: (v: ReturnType<typeof run>) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve().then(run).then(res, rej),
    };
    return b;
  };
  return { client: { from } as never, calls, tables };
}

const q = (id: string, type: string, level: number, extra: Row = {}): Row => ({
  id, type, difficulty_level: level, active: true, text: id,
  options: [{ id: 'a', text: `${id}-a` }, { id: 'b', text: `${id}-b` }], correct_answer: 0, ...extra,
});

function bank() {
  const questions: Row[] = [];
  for (const type of ['sentence_completion', 'restatement']) {
    for (let level = 1; level <= 5; level++) {
      for (let n = 0; n < 8; n++) questions.push(q(`${type[0]}${level}-${n}`, type, level));
    }
  }
  return questions;
}

describe('fetchMixedSingles', () => {
  it('fills each type from unseen questions at the requested level', async () => {
    const db = fakeSupabase({ questions: bank(), user_question_history: [] });
    const out = await fetchMixedSingles({
      supabase: db.client, userKey: 'u1', levels: [3],
      requests: [{ type: 'sentence_completion', needed: 4 }, { type: 'restatement', needed: 2 }],
    });
    expect(out.get('sentence_completion')!.map(x => x.id).every(id => id.startsWith('s3-'))).toBe(true);
    expect(out.get('sentence_completion')).toHaveLength(4);
    expect(out.get('restatement')).toHaveLength(2);
  });

  it('reads history once, by user_key alone — never with a long id list', async () => {
    const db = fakeSupabase({ questions: bank(), user_question_history: [] });
    await fetchMixedSingles({
      supabase: db.client, userKey: 'u1', levels: [1, 2, 3, 4, 5],
      requests: [{ type: 'sentence_completion', needed: 6 }, { type: 'restatement', needed: 3 }],
    });
    const historyReads = db.calls.filter(c => c.table === 'user_question_history' && c.op === 'select');
    expect(historyReads).toHaveLength(1);
    expect(historyReads[0].filters).toEqual([['eq', 'user_key', 'u1']]);
    // One batch of question rows (≤ 100 ids per request), not one per type × level.
    const rowFetches = db.calls.filter(c => c.table === 'questions' && c.filters.some(f => f[0] === 'in'));
    expect(rowFetches.length).toBeLessThanOrEqual(2);
  });

  it('skips seen questions while enough unseen remain', async () => {
    const seen = ['s3-0', 's3-1', 's3-2', 's3-3'].map(id => ({ user_key: 'u1', question_id: id }));
    const db = fakeSupabase({ questions: bank(), user_question_history: seen });
    const out = await fetchMixedSingles({
      supabase: db.client, userKey: 'u1', levels: [3], requests: [{ type: 'sentence_completion', needed: 4 }],
    });
    expect(out.get('sentence_completion')!.map(x => x.id).sort()).toEqual(['s3-4', 's3-5', 's3-6', 's3-7']);
    expect(db.calls.some(c => c.op === 'delete')).toBe(false);
  });

  it('resets only the exhausted type+level history and serves from the full pool', async () => {
    const seen = [
      ...Array.from({ length: 7 }, (_, n) => ({ user_key: 'u1', question_id: `s3-${n}` })),
      { user_key: 'u1', question_id: 'r3-0' },
    ];
    const db = fakeSupabase({ questions: bank(), user_question_history: seen });
    const out = await fetchMixedSingles({
      supabase: db.client, userKey: 'u1', levels: [3], requests: [{ type: 'sentence_completion', needed: 4 }],
    });
    expect(out.get('sentence_completion')).toHaveLength(4);
    expect(db.tables.user_question_history.map(r => r.question_id)).toEqual(['r3-0']);
  });

  it('comes back short (not padded) when the pool is short, and skips a type at 0', async () => {
    const db = fakeSupabase({ questions: bank().filter(r => r.type === 'sentence_completion' || r.id === 'r3-0'), user_question_history: [] });
    const out = await fetchMixedSingles({
      supabase: db.client, userKey: null, levels: [3],
      requests: [{ type: 'sentence_completion', needed: 0 }, { type: 'restatement', needed: 3 }],
    });
    expect(out.get('restatement')!.map(x => x.id)).toEqual(['r3-0']);
    expect(out.get('sentence_completion')).toEqual([]);
    expect(db.calls.some(c => c.filters.some(f => f[1] === 'type' && f[2] === 'sentence_completion'))).toBe(false);
  });
});

describe('fetchMixedPassages', () => {
  const passages = (level: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${level}-${i}`, text: 'T', difficulty_level: level, b: 0, active: true }));
  const rcQuestions = (pid: string) =>
    Array.from({ length: 5 }, (_, i) => q(`${pid}-q${i}`, 'reading_comprehension', 3, { passage_id: pid }));

  it('returns one distinct block per requested level, questions grouped by passage', async () => {
    const ps = passages(3, 3);
    const db = fakeSupabase({ passages: ps, questions: ps.flatMap(p => rcQuestions(p.id)), user_passage_history: [] });
    const blocks = await fetchMixedPassages({ supabase: db.client, userKey: 'u1', levels: [3, 3] });
    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map(b => b[0].passage_id)).size).toBe(2);
    blocks.forEach(b => {
      expect(b).toHaveLength(5);
      expect(new Set(b.map((x: Question) => x.passage_id)).size).toBe(1);
    });
  });

  it('avoids seen passages, and resets passage history only when a level runs out', async () => {
    const ps = passages(3, 2);
    const db = fakeSupabase({
      passages: ps, questions: ps.flatMap(p => rcQuestions(p.id)),
      user_passage_history: [{ user_key: 'u1', passage_id: 'p3-0' }],
    });
    const [only] = await fetchMixedPassages({ supabase: db.client, userKey: 'u1', levels: [3] });
    expect(only[0].passage_id).toBe('p3-1');
    expect(db.tables.user_passage_history).toHaveLength(1);

    db.tables.user_passage_history.push({ user_key: 'u1', passage_id: 'p3-1' });
    const again = await fetchMixedPassages({ supabase: db.client, userKey: 'u1', levels: [3] });
    expect(again).toHaveLength(1);
    expect(db.tables.user_passage_history).toHaveLength(0);
  });

  it('asks for nothing when no passages are wanted', async () => {
    const db = fakeSupabase({});
    expect(await fetchMixedPassages({ supabase: db.client, userKey: 'u1', levels: [] })).toEqual([]);
    expect(db.calls).toHaveLength(0);
  });
});
