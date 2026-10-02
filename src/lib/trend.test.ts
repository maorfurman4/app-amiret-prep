import { describe, expect, it } from 'vitest';
import { computeTrend } from './trend';

function session(daysFromEpoch: number, score: number) {
  return { score, completed_at: new Date(daysFromEpoch * 86_400_000).toISOString() };
}

describe('computeTrend', () => {
  it('returns null with fewer than 4 sessions', () => {
    const sessions = [session(0, 90), session(1, 95), session(2, 100)];
    expect(computeTrend(sessions)).toBeNull();
  });

  it('returns null when sessions span fewer than 3 distinct calendar days', () => {
    // 5 sessions, but all crammed into 2 distinct days
    const sessions = [
      session(0, 90), session(0.1, 95), session(0.2, 100),
      session(1, 102), session(1.1, 104),
    ];
    expect(computeTrend(sessions)).toBeNull();
  });

  it('measures points per day, not per exam', () => {
    // Perfectly linear: +2 points/day, starting at 100 on day 0.
    const sessions = [session(0, 100), session(1, 102), session(2, 104), session(3, 106)];
    const trend = computeTrend(sessions)!;
    expect(trend.slopePerDay).toBeCloseTo(2, 5);
    expect(trend.currentScore).toBe(106);
  });

  it('reports a flat trend as ~0, in any input order', () => {
    const sessions = [session(3, 100), session(0, 100), session(2, 99), session(1, 100)];
    const trend = computeTrend(sessions)!;
    expect(Math.abs(trend.slopePerDay)).toBeLessThan(0.5);
    expect(trend.currentScore).toBe(100);
  });

  it('projects nothing: the result carries no target date', () => {
    const trend = computeTrend([session(0, 100), session(1, 102), session(2, 104), session(3, 106)])!;
    expect(Object.keys(trend).sort()).toEqual(['currentScore', 'slopePerDay']);
  });
});
