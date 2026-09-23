import { describe, expect, it } from 'vitest';
import { computeForecast } from './forecast';

function session(daysFromEpoch: number, score: number) {
  return { score, completed_at: new Date(daysFromEpoch * 86_400_000).toISOString() };
}

describe('computeForecast', () => {
  it('returns null with fewer than 4 sessions', () => {
    const sessions = [session(0, 90), session(1, 95), session(2, 100)];
    expect(computeForecast(sessions, 134)).toBeNull();
  });

  it('returns null when sessions span fewer than 3 distinct calendar days', () => {
    // 5 sessions, but all crammed into 2 distinct days
    const sessions = [
      session(0, 90), session(0.1, 95), session(0.2, 100),
      session(1, 102), session(1.1, 104),
    ];
    expect(computeForecast(sessions, 134)).toBeNull();
  });

  it('reports a flat/negative trend as no projection, not a fabricated date', () => {
    const sessions = [session(0, 100), session(1, 100), session(2, 99), session(3, 100)];
    const forecast = computeForecast(sessions, 134);
    expect(forecast).not.toBeNull();
    expect(forecast!.projectedDate).toBeNull();
    expect(forecast!.daysToTarget).toBeNull();
  });

  it('projects a target date for a clean positive trend', () => {
    // Perfectly linear: +2 points/day, starting at 100 on day 0.
    const sessions = [session(0, 100), session(1, 102), session(2, 104), session(3, 106)];
    const forecast = computeForecast(sessions, 110);
    expect(forecast).not.toBeNull();
    expect(forecast!.slopePerDay).toBeCloseTo(2, 5);
    // At day 3 the line is at 106; needs +4 more points at +2/day = 2 more days.
    expect(forecast!.daysToTarget).toBe(2);
    expect(forecast!.projectedDate).toBe(new Date(5 * 86_400_000).toISOString().slice(0, 10));
  });

  it('reports the target as already reached with no projection needed', () => {
    const sessions = [session(0, 130), session(1, 132), session(2, 140), session(3, 138)];
    const forecast = computeForecast(sessions, 134);
    expect(forecast).not.toBeNull();
    expect(forecast!.daysToTarget).toBe(0);
    expect(forecast!.projectedDate).toBeNull();
  });
});
