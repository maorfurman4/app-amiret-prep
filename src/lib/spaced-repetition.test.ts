import { describe, expect, it } from 'vitest';
import { nextInterval, addDays, isDue } from './spaced-repetition';

describe('nextInterval', () => {
  it('doubles the current interval', () => {
    expect(nextInterval(1, 30)).toBe(2);
    expect(nextInterval(4, 30)).toBe(8);
  });

  it('treats anything below 1 day as 1 day before doubling', () => {
    expect(nextInterval(0, 30)).toBe(2);
  });

  it('caps at the given maximum', () => {
    expect(nextInterval(20, 30)).toBe(30);
    expect(nextInterval(30, 30)).toBe(30);
  });

  it('supports different caps for different surfaces', () => {
    expect(nextInterval(40, 60)).toBe(60);
  });
});

describe('addDays', () => {
  it('adds whole days without mutating the input', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const result = addDays(start, 5);
    expect(result.toISOString()).toBe('2026-01-06T00:00:00.000Z');
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('isDue', () => {
  it('is due when the review date is in the past', () => {
    expect(isDue('2026-01-01T00:00:00.000Z', new Date('2026-01-02T00:00:00.000Z'))).toBe(true);
  });

  it('is not due when the review date is in the future', () => {
    expect(isDue('2026-01-05T00:00:00.000Z', new Date('2026-01-02T00:00:00.000Z'))).toBe(false);
  });

  it('is due exactly at the review moment', () => {
    const t = '2026-01-02T00:00:00.000Z';
    expect(isDue(t, new Date(t))).toBe(true);
  });
});
