import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateOwnerTheta, isInSweetSpot, predictCorrect } from './ability';

function client(rows: { correct: boolean; questions: { b: number; c: number } | null }[]) {
  const chain: Record<string, unknown> = { then: (res: (v: unknown) => void) => res({ data: rows, error: null }) };
  for (const m of ['select', 'eq', 'not', 'order', 'limit']) chain[m] = () => chain;
  return { from: () => chain } as unknown as SupabaseClient;
}

describe('ability', () => {
  it('sweet spot is the closed band [0.5, 0.85]', () => {
    expect([0.49, 0.5, 0.7, 0.85, 0.86, null].map(isInSweetSpot)).toEqual([false, true, true, true, false, false]);
  });

  it('predicts with the baseline IRT parameters', () => {
    expect(predictCorrect(0, { b: 0, c: 0.25 })).toBeCloseTo(0.625, 10);
    expect(predictCorrect(3, { b: -3, c: 0.25 })).toBeGreaterThan(0.99);
  });

  it('a new student starts at the prior mean', async () => {
    expect(await estimateOwnerTheta(client([]), { id: 'x', type: 'guest' })).toBe(0);
  });

  it('rises with correct answers on hard items and falls with misses on easy ones', async () => {
    const strong = Array.from({ length: 20 }, () => ({ correct: true, questions: { b: 1.5, c: 0.25 } }));
    const weak = Array.from({ length: 20 }, () => ({ correct: false, questions: { b: -1.5, c: 0.25 } }));
    expect(await estimateOwnerTheta(client(strong), { id: 'x', type: 'user' })).toBeGreaterThan(1);
    expect(await estimateOwnerTheta(client(weak), { id: 'x', type: 'user' })).toBeLessThan(-1);
  });

  it('ignores rows whose item is gone', async () => {
    expect(await estimateOwnerTheta(client([{ correct: true, questions: null }]), { id: 'x', type: 'user' })).toBe(0);
  });
});
