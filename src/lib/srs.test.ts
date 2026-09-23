import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyResponsesToSrs, foldEvents, selectDueReviewQuestions, recapCardsToExam } from './srs';
import { MS_PER_DAY, FSRS_WEIGHTS } from './fsrs';

// ── A small in-memory stand-in for the supabase-js query builder ─────────────

type Row = Record<string, unknown>;
interface FakeDb { [table: string]: Row[] }

function fakeSupabase(db: FakeDb, hooks: { beforeUpdate?: (table: string) => void } = {}) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'srs_pick_siblings') {
      const keys = args.p_concept_keys as string[];
      const exclude = new Set(args.p_exclude_question_ids as string[]);
      const picked = new Map<string, string>();
      for (const q of db.questions ?? []) {
        const key = q.concept_key as string;
        if (q.active && keys.includes(key) && !exclude.has(q.id as string) && !picked.has(key)) picked.set(key, q.id as string);
      }
      return { data: [...picked].map(([concept_key, question_id]) => ({ concept_key, question_id })), error: null };
    }
    return { data: null, error: null };
  });

  function from(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'update' | 'upsert' | 'delete' | 'insert' = 'select';
    let inserted: Row[] = [];
    let payload: Row = {};
    let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let single = false;
    const rows = () => (db[table] ??= []);

    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q; },
      in: (c: string, vs: unknown[]) => { filters.push(r => vs.includes(r[c])); return q; },
      lte: (c: string, v: string) => { filters.push(r => String(r[c]) <= v); return q; },
      gte: (c: string, v: string) => { filters.push(r => String(r[c]) >= v); return q; },
      gt: (c: string, v: string) => { filters.push(r => String(r[c]) > v); return q; },
      lt: (c: string, v: number) => { filters.push(r => (r[c] as number) < v); return q; },
      order: (col: string, o: { ascending: boolean }) => { order = { col, asc: o.ascending }; return q; },
      limit: (n: number) => { limit = n; return q; },
      maybeSingle: () => { single = true; return q; },
      update: (p: Row) => { op = 'update'; payload = p; return q; },
      delete: () => { op = 'delete'; return q; },
      insert: (r: Row | Row[]) => { op = 'insert'; inserted = Array.isArray(r) ? r : [r]; return q; },
      upsert: (p: Row, o: typeof upsertOpts) => { op = 'upsert'; payload = p; upsertOpts = o; return q; },
      then(resolve: (v: { data: unknown; error: null }) => void) {
        const match = (r: Row) => filters.every(f => f(r));
        let data: unknown;
        if (op === 'select') {
          let out = rows().filter(match);
          if (order) { const { col, asc } = order; out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)); }
          if (limit !== null) out = out.slice(0, limit);
          data = single ? out[0] ?? null : out;
        } else if (op === 'update') {
          hooks.beforeUpdate?.(table);
          const hit = rows().filter(match);
          hit.forEach(r => Object.assign(r, payload));
          data = hit.map(r => ({ id: r.id }));
        } else if (op === 'insert') {
          rows().push(...inserted.map(r => ({ id: rows().length + 1, ...r })));
          data = null;
        } else if (op === 'delete') {
          db[table] = rows().filter(r => !match(r));
          data = null;
        } else {
          const keys = (upsertOpts.onConflict ?? '').split(',');
          const clash = rows().find(r => keys.every(k => r[k] === payload[k]));
          if (clash) data = [];
          else {
            const row = { id: rows().length + 1, version: 0, ...payload };
            rows().push(row);
            data = [{ id: row.id }];
          }
        }
        resolve({ data, error: null });
      },
    };
    return q;
  }
  return { client: { from, rpc } as unknown as SupabaseClient, rpc };
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date('2026-10-01T12:00:00.000Z');
const iso = (d: Date) => d.toISOString();
const daysFrom = (n: number) => new Date(NOW.getTime() + n * MS_PER_DAY);

const Q = (id: string, concept_key: string, extra: Row = {}): Row => ({
  id, concept_key, type: 'sentence_completion', skill: 'sc.vocab',
  target_lemma: concept_key.split('/')[1] ?? null, active: true, passage_id: null,
  text: `text ${id}`, options: [], correct_answer: 0, ...extra,
});

const card = (overrides: Row = {}): Row => ({
  id: 1, owner_id: 'guest-1', owner_type: 'guest', concept_key: 'sc.vocab/replace',
  item_type: 'sentence_completion', anchor_question_id: 'q-replace-1',
  stability: 2, difficulty: 6, reps: 2, lapses: 1,
  last_review_at: iso(daysFrom(-3)), due_at: iso(daysFrom(-1)), version: 4,
  ...overrides,
});

const GUEST = { id: 'guest-1', type: 'guest' as const };

// ── foldEvents (pure) ────────────────────────────────────────────────────────

describe('foldEvents', () => {
  it('ignores correct answers on a concept with no card', () => {
    expect(foldEvents(null, 'sentence_completion', [{ itemId: 'x', correct: true, latencyMs: 20_000 }], NOW).state).toBeNull();
  });

  it('creates a card from the first mistake', () => {
    const r = foldEvents(null, 'sentence_completion', [
      { itemId: 'ok', correct: true, latencyMs: 20_000 },
      { itemId: 'miss', correct: false, latencyMs: 20_000 },
    ], NOW);
    expect(r.createdBy?.itemId).toBe('miss');
    expect(r.state).toMatchObject({ stability: FSRS_WEIGHTS[0], lapses: 1 });
  });

  it('a right answer moments after the mistake does not inflate the memory', () => {
    const r = foldEvents(null, 'sentence_completion', [
      { itemId: 'miss', correct: false, latencyMs: 20_000, at: NOW },
      { itemId: 'sib', correct: true, latencyMs: 20_000, at: new Date(NOW.getTime() + 60_000) },
    ], NOW);
    expect(r.state!.stability / FSRS_WEIGHTS[0]).toBeLessThan(1.05);
  });

  it('Ring B: an answered review of a DUE card counts (right or wrong); not-due or blank never does', () => {
    const due = card() as never;
    const notDue = card({ due_at: iso(daysFrom(3)) }) as never;
    const right = [{ itemId: 'q', correct: true, latencyMs: 30_000 }];
    const wrong = [{ itemId: 'q', correct: false, latencyMs: 30_000 }];
    const blank = [{ itemId: 'q', correct: false, answered: false, latencyMs: 30_000 }];
    expect(foldEvents(due, 'sentence_completion', right, NOW).cleared).toBe(true);
    expect(foldEvents(due, 'sentence_completion', wrong, NOW).cleared).toBe(true);
    expect(foldEvents(due, 'sentence_completion', blank, NOW).cleared).toBe(false);
    expect(foldEvents(notDue, 'sentence_completion', right, NOW).cleared).toBe(false);
  });

  it('closes the old loophole: wrong → immediately right is never a due review', () => {
    const r = foldEvents(null, 'sentence_completion', [
      { itemId: 'miss', correct: false, latencyMs: 20_000, at: NOW },
      { itemId: 'sib', correct: true, latencyMs: 20_000, at: new Date(NOW.getTime() + 60_000) },
    ], NOW);
    expect(r.cleared).toBe(false);
    expect(r.logs.map(l => l.wasDue)).toEqual([false, false]);
  });

  it('logs every state change with before/after state and real elapsed time', () => {
    const due = card({ stability: 2, difficulty: 6, last_review_at: iso(daysFrom(-3)) }) as never;
    const { logs } = foldEvents(due, 'sentence_completion', [
      { itemId: 'a', correct: true, latencyMs: 30_000 },
      { itemId: 'b', correct: true, latencyMs: 30_000 },
    ], NOW);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ itemId: 'a', grade: 3, answered: true, wasDue: true, stabilityBefore: 2, difficultyBefore: 6 });
    expect(logs[0].elapsedDays).toBeCloseTo(3, 6);
    // Only the first review in a batch can be the due one.
    expect(logs[1]).toMatchObject({ itemId: 'b', wasDue: false, stabilityBefore: logs[0].stabilityAfter });
    expect(logs[1].elapsedDays).toBe(0);
  });
});

// ── applyResponsesToSrs ──────────────────────────────────────────────────────

describe('applyResponsesToSrs', () => {
  let db: FakeDb;
  beforeEach(() => {
    db = {
      questions: [Q('q-replace-1', 'sc.vocab/replace'), Q('q-replace-2', 'sc.vocab/replace'), Q('q-raise', 'sc.vocab/raise')],
      srs_cards: [],
      user_goals: [],
    };
  });

  it('a mistake creates one concept card anchored on the missed question, and logs its creation', async () => {
    const { client } = fakeSupabase(db);
    const res = await applyResponsesToSrs(client, GUEST, [{ itemId: 'q-raise', correct: false, latencyMs: 30_000 }], NOW);
    expect(res).toMatchObject({ created: 1, reviewed: 0, error: null });
    const [c] = db.srs_cards;
    expect(c).toMatchObject({ concept_key: 'sc.vocab/raise', anchor_question_id: 'q-raise', item_type: 'sentence_completion', skill: 'sc.vocab', target_lemma: 'raise', lapses: 1 });
    // First-lapse stability ≈ 0.49 d → due in ~12 hours, not immediately.
    const hours = (new Date(c.due_at as string).getTime() - NOW.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(6);
    expect(hours).toBeLessThan(13);
    expect(db.srs_review_log).toEqual([expect.objectContaining({
      owner_id: 'guest-1', owner_type: 'guest', card_id: c.id, concept_key: 'sc.vocab/raise', item_id: 'q-raise',
      grade: 1, answered: true, was_due: false, elapsed_days: null, stability_before: null,
    })]);
  });

  it('a sibling answered correctly reviews the SAME concept card; the log marks it a due review', async () => {
    db.srs_cards.push(card());
    const { client, rpc } = fakeSupabase(db);
    const res = await applyResponsesToSrs(client, GUEST, [{ itemId: 'q-replace-2', correct: true, latencyMs: 30_000 }], NOW);
    expect(res).toMatchObject({ created: 0, reviewed: 1, cleared: 1 });
    expect(db.srs_cards).toHaveLength(1);
    expect(db.srs_cards[0]).toMatchObject({ version: 5, reps: 3 });
    expect(db.srs_cards[0].stability as number).toBeGreaterThan(2);
    expect(db.srs_review_log).toEqual([expect.objectContaining({
      card_id: 1, concept_key: 'sc.vocab/replace', item_id: 'q-replace-2', was_due: true, answered: true, grade: 3,
    })]);
    // No client-trusting counter any more — Ring B reads the log.
    expect(rpc).not.toHaveBeenCalledWith('increment_daily_activity', expect.anything());
  });

  it('correct answers on concepts without a card write nothing', async () => {
    const { client, rpc } = fakeSupabase(db);
    const res = await applyResponsesToSrs(client, GUEST, [{ itemId: 'q-raise', correct: true, latencyMs: 30_000 }], NOW);
    expect(res).toMatchObject({ created: 0, reviewed: 0 });
    expect(db.srs_cards).toHaveLength(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('loses a concurrent-write race safely: re-reads and replays on the winner’s state', async () => {
    db.srs_cards.push(card());
    let raced = false;
    const { client } = fakeSupabase(db, {
      beforeUpdate: table => {
        // Another request commits a review first, bumping the version.
        if (table === 'srs_cards' && !raced) { raced = true; Object.assign(db.srs_cards[0], { version: 5, reps: 3 }); }
      },
    });
    const res = await applyResponsesToSrs(client, GUEST, [{ itemId: 'q-replace-1', correct: true, latencyMs: 30_000 }], NOW);
    expect(res.reviewed).toBe(1);
    // Built on top of the winner's write (reps 3 → 4, version 5 → 6), not the stale read.
    expect(db.srs_cards[0]).toMatchObject({ version: 6, reps: 4 });
  });

  it('caps a signed-in student’s schedule to their exam date', async () => {
    db.user_goals.push({ user_id: 'user-1', exam_date: '2026-10-10' });
    db.srs_cards.push(card({ owner_id: 'user-1', owner_type: 'user', stability: 30, last_review_at: iso(daysFrom(-25)) }));
    const { client } = fakeSupabase(db);
    await applyResponsesToSrs(client, { id: 'user-1', type: 'user' }, [{ itemId: 'q-replace-1', correct: true, latencyMs: 30_000 }], NOW);
    // Without an exam this would be months out; with it, 2 days before the 06:00 UTC sitting.
    expect(db.srs_cards[0].due_at).toBe('2026-10-08T06:00:00.000Z');
  });
});

// ── selectDueReviewQuestions ────────────────────────────────────────────────

describe('selectDueReviewQuestions', () => {
  it('serves a sibling when one exists, the anchor when none does, and skips cards not due', async () => {
    const db: FakeDb = {
      questions: [
        Q('q-replace-1', 'sc.vocab/replace'), Q('q-replace-2', 'sc.vocab/replace'), Q('q-replace-3', 'sc.vocab/replace'),
        Q('q-lonely', 'sc.vocab/lonely'),
        Q('q-later', 'sc.vocab/later'), Q('q-later-2', 'sc.vocab/later'),
      ],
      srs_cards: [
        card({ id: 1, concept_key: 'sc.vocab/replace', anchor_question_id: 'q-replace-1', due_at: iso(daysFrom(-2)) }),
        card({ id: 2, concept_key: 'sc.vocab/lonely', anchor_question_id: 'q-lonely', due_at: iso(daysFrom(-1)) }),
        card({ id: 3, concept_key: 'sc.vocab/later', anchor_question_id: 'q-later', due_at: iso(daysFrom(2)) }),
      ],
      // q-replace-2 was answered recently → must not be picked as the sibling.
      responses: [{ owner_id: 'guest-1', owner_type: 'guest', item_id: 'q-replace-2', created_at: iso(daysFrom(-1)) }],
    };
    const { client, rpc } = fakeSupabase(db);
    const { questions, error } = await selectDueReviewQuestions(client, GUEST, { now: NOW });

    expect(error).toBeNull();
    expect(questions.map(q => [q.id, q.review])).toEqual([
      ['q-replace-3', { conceptKey: 'sc.vocab/replace', sibling: true }],
      ['q-lonely', { conceptKey: 'sc.vocab/lonely', sibling: false }],
    ]);
    const args = rpc.mock.calls.find(([name]) => name === 'srs_pick_siblings')![1] as { p_exclude_question_ids: string[] };
    expect(args.p_exclude_question_ids).toEqual(expect.arrayContaining(['q-replace-1', 'q-lonely', 'q-replace-2']));
  });

  it('returns nothing (and makes no further queries) when nothing is due', async () => {
    const { client, rpc } = fakeSupabase({ srs_cards: [card({ due_at: iso(daysFrom(1)) })] });
    expect((await selectDueReviewQuestions(client, GUEST, { now: NOW })).questions).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('recapCardsToExam', () => {
  it('pulls only cards due after the peak window into it', async () => {
    const db: FakeDb = { srs_cards: [
      card({ id: 1, concept_key: 'a', due_at: iso(daysFrom(2)) }),
      card({ id: 2, concept_key: 'b', due_at: iso(daysFrom(40)) }),
    ] };
    const { client } = fakeSupabase(db);
    await recapCardsToExam(client, GUEST, new Date('2026-10-20T06:00:00.000Z'), NOW);
    expect(db.srs_cards.map(c => c.due_at)).toEqual([iso(daysFrom(2)), '2026-10-18T06:00:00.000Z']);
  });
});
