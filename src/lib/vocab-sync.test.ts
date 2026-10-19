import { describe, expect, it } from 'vitest';
import { addPending, applyPending, PENDING_SYNC_KEY, readPending, sendOrQueue, settlePending, writePending, type PendingOp } from './vocab-sync';

const knew = (wordId: string, interval_days = 1): PendingOp =>
  ({ kind: 'known', op: 'upsert', wordId, interval_days, next_review_at: `2026-10-${10 + interval_days}T00:00:00Z` });

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    m,
  };
}

describe('vocab outbox (QA M-7)', () => {
  it('keeps only the latest change per word', () => {
    let ops: PendingOp[] = [];
    ops = addPending(ops, knew('w1'));
    ops = addPending(ops, { kind: 'fav', op: 'upsert', wordId: 'w1' });
    ops = addPending(ops, { kind: 'known', op: 'delete', wordId: 'w1' });
    expect(ops).toEqual([{ kind: 'fav', op: 'upsert', wordId: 'w1' }, { kind: 'known', op: 'delete', wordId: 'w1' }]);
  });

  it('"clear all" replaces every earlier change of its kind only', () => {
    let ops: PendingOp[] = [knew('w1'), knew('w2'), { kind: 'fav', op: 'upsert', wordId: 'w3' }];
    ops = addPending(ops, { kind: 'known', op: 'clear' });
    expect(ops).toEqual([{ kind: 'fav', op: 'upsert', wordId: 'w3' }, { kind: 'known', op: 'clear' }]);
  });

  it('a change that reached the account drops the stale queued one, so it is never replayed', () => {
    const ops = [knew('w1'), knew('w2')];
    expect(settlePending(ops, { kind: 'known', op: 'delete', wordId: 'w1' })).toEqual([knew('w2')]);
  });

  it('applies unsent changes on top of the account rows', () => {
    const account = {
      known: new Set(['w1', 'w2']),
      schedule: { w1: { interval_days: 4, next_review_at: 'a' }, w2: { interval_days: 2, next_review_at: 'b' } },
      favorites: new Set(['w9']),
    };
    const out = applyPending(account, [knew('w3', 1), { kind: 'known', op: 'delete', wordId: 'w2' }, { kind: 'fav', op: 'clear' }, { kind: 'fav', op: 'upsert', wordId: 'w1' }]);
    expect([...out.known].sort()).toEqual(['w1', 'w3']);
    expect(out.schedule).toEqual({ w1: { interval_days: 4, next_review_at: 'a' }, w3: { interval_days: 1, next_review_at: '2026-10-11T00:00:00Z' } });
    expect([...out.favorites]).toEqual(['w1']);
    // The account's own copy is untouched.
    expect([...account.known].sort()).toEqual(['w1', 'w2']);
  });

  it('stores per account, and never hands one account\'s changes to another', () => {
    const store = memoryStore();
    writePending('u1', [knew('w1')], store);
    expect(readPending('u1', store)).toEqual([knew('w1')]);
    expect(readPending('u2', store)).toEqual([]);
    writePending('u1', [], store);
    expect(store.m.has(PENDING_SYNC_KEY)).toBe(false);
  });

  it('treats unreadable storage as an empty outbox', () => {
    const store = memoryStore();
    store.setItem(PENDING_SYNC_KEY, '{not json');
    expect(readPending('u1', store)).toEqual([]);
    expect(readPending('u1', null)).toEqual([]);
  });
});

describe('sendOrQueue', () => {
  it('queues a review the account did not get, for /vocabulary to re-send', async () => {
    const store = memoryStore();
    const ok = await sendOrQueue('u1', knew('w1', 4), () => Promise.resolve({ error: { message: 'fetch failed' } }), store);
    expect(ok).toBe(false);
    expect(readPending('u1', store)).toEqual([knew('w1', 4)]);
  });

  it('queues a write that throws', async () => {
    const store = memoryStore();
    await sendOrQueue('u1', knew('w1'), () => Promise.reject(new Error('offline')), store);
    expect(readPending('u1', store)).toEqual([knew('w1')]);
  });

  it('settles an older queued change for the same word once one gets through', async () => {
    const store = memoryStore();
    writePending('u1', [knew('w1', 1), knew('w2', 1)], store);
    const ok = await sendOrQueue('u1', knew('w1', 2), () => Promise.resolve({ error: null }), store);
    expect(ok).toBe(true);
    expect(readPending('u1', store)).toEqual([knew('w2', 1)]);
  });
});

