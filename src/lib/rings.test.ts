import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeRings, ringProgress, type Rings } from './rings';

const rings = (o: Partial<{ effort: number; target: number; done: number; due: number; sim: boolean }> = {}): Rings => ({
  effort: { done: o.effort ?? 0, target: o.target ?? 15 },
  retention: { done: o.done ?? 0, due: o.due ?? 0 },
  simulation: { done: o.sim ?? false },
});

describe('ringProgress', () => {
  it('fills effort toward the target and clamps at full', () => {
    expect(ringProgress(rings({ effort: 6, target: 15 })).effort).toBeCloseTo(0.4, 10);
    expect(ringProgress(rings({ effort: 40, target: 15 })).effort).toBe(1);
    expect(ringProgress(rings({ effort: 3, target: 0 })).effort).toBe(1); // no divide-by-zero
  });

  it('retention is done/(done + still due); an empty queue counts as settled', () => {
    expect(ringProgress(rings({ done: 2, due: 3 })).retention).toBeCloseTo(0.4, 10);
    expect(ringProgress(rings({ done: 0, due: 0 })).retention).toBe(1);
    expect(ringProgress(rings({ done: 0, due: 4 })).retention).toBe(0);
  });

  it('simulation is binary', () => {
    expect(ringProgress(rings({ sim: true })).simulation).toBe(1);
    expect(ringProgress(rings()).simulation).toBe(0);
  });
});

/** Records every filter applied per table and answers with a fixed count. */
function recorder(counts: Record<string, number>) {
  const calls: Record<string, [string, ...unknown[]][]> = {};
  const from = vi.fn((table: string) => {
    const log = (calls[table] = [] as [string, ...unknown[]][]);
    const chain: Record<string, unknown> = {
      then: (resolve: (v: { count: number; error: null }) => void) => resolve({ count: counts[table] ?? 0, error: null }),
    };
    for (const m of ['select', 'eq', 'in', 'not', 'gte', 'lte']) {
      chain[m] = (...args: unknown[]) => { log.push([m, ...args]); return chain; };
    }
    return chain;
  });
  return { client: { from } as unknown as SupabaseClient, calls };
}

describe('computeRings (server-side sources)', () => {
  const NOW = new Date('2026-09-23T10:00:00Z'); // Wed, IDT

  it('reads each ring from verified data with the right filters and windows', async () => {
    const { client, calls } = recorder({ responses: 7, srs_review_log: 3, exam_sessions: 1 });
    const r = await computeRings(client, { id: 'u1', type: 'user' }, { effortTarget: 20, dueNow: 5, now: NOW });

    expect(r).toEqual({ effort: { done: 7, target: 20 }, retention: { done: 3, due: 5 }, simulation: { done: true } });

    const today = '2026-09-22T21:00:00.000Z'; // local midnight
    expect(calls.responses).toEqual(expect.arrayContaining([
      ['eq', 'owner_type', 'user'], ['eq', 'owner_id', 'u1'],
      ['in', 'context', ['practice', 'diagnostic']],
      ['not', 'chosen_option', 'is', null],
      ['gte', 'p_correct', 0.5], ['lte', 'p_correct', 0.85],
      ['gte', 'created_at', today],
    ]));
    expect(calls.srs_review_log).toEqual(expect.arrayContaining([
      ['eq', 'was_due', true], ['eq', 'answered', true], ['gte', 'reviewed_at', today],
    ]));
    expect(calls.exam_sessions).toEqual(expect.arrayContaining([
      ['eq', 'user_id', 'u1'], ['eq', 'is_practice', false], ['not', 'score', 'is', null],
      ['gte', 'completed_at', '2026-09-19T21:00:00.000Z'], // Sunday 00:00 local
    ]));
  });

  it('reports no simulation when there is no completed exam this week', async () => {
    const { client } = recorder({ exam_sessions: 0 });
    const r = await computeRings(client, { id: 'g1', type: 'guest' }, { dueNow: 0, now: NOW });
    expect(r.simulation.done).toBe(false);
    expect(r.effort.target).toBe(15);
  });
});
