import { describe, expect, it } from 'vitest';
import { computePracticeActivity, aggregateErrorCauses, ERROR_CAUSE_MIN } from './practice-activity';

describe('computePracticeActivity', () => {
  it('counts rows as questions and distinct local days as days', () => {
    const rows = [
      // Two answers on the same Israel day (both 2026-10-01 local).
      { created_at: '2026-10-01T08:00:00Z' },
      { created_at: '2026-10-01T20:00:00Z' },
      // A different day.
      { created_at: '2026-10-03T09:00:00Z' },
    ];
    expect(computePracticeActivity(rows)).toEqual({ questions: 3, days: 2 });
  });

  it('groups by the Israel calendar day, not UTC (late-night answer counts as the local date)', () => {
    // 2026-10-01T22:30Z is 2026-10-02 01:30 in Jerusalem — a distinct local day
    // from 2026-10-01T05:00Z (08:00 local, same date).
    const rows = [
      { created_at: '2026-10-01T05:00:00Z' },
      { created_at: '2026-10-01T22:30:00Z' },
    ];
    expect(computePracticeActivity(rows)).toEqual({ questions: 2, days: 2 });
  });

  it('is zeroed for no activity', () => {
    expect(computePracticeActivity([])).toEqual({ questions: 0, days: 0 });
  });
});

describe('aggregateErrorCauses', () => {
  it('counts per cause, ordered by size, with shares of the tagged total', () => {
    const rows = [
      { error_cause: 'vocab' as const },
      { error_cause: 'vocab' as const },
      { error_cause: 'vocab' as const },
      { error_cause: 'logic' as const },
      { error_cause: 'time' as const },
    ];
    const b = aggregateErrorCauses(rows);
    expect(b.total).toBe(5);
    expect(b.top).toBe('vocab');
    expect(b.slices.map(s => s.cause)).toEqual(['vocab', 'logic', 'time']);
    expect(b.slices[0]).toEqual({ cause: 'vocab', count: 3, share: 0.6 });
    // Untagged causes don't appear.
    expect(b.slices.some(s => s.cause === 'careless')).toBe(false);
  });

  it('flags enough only at or above the threshold', () => {
    const below = Array.from({ length: ERROR_CAUSE_MIN - 1 }, () => ({ error_cause: 'vocab' as const }));
    const at = Array.from({ length: ERROR_CAUSE_MIN }, () => ({ error_cause: 'vocab' as const }));
    expect(aggregateErrorCauses(below).enough).toBe(false);
    expect(aggregateErrorCauses(at).enough).toBe(true);
  });

  it('is an empty, not-enough breakdown for no tagged errors', () => {
    const b = aggregateErrorCauses([]);
    expect(b).toEqual({ total: 0, enough: false, slices: [], top: null });
  });
});
