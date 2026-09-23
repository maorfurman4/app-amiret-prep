import { describe, it, expect } from 'vitest';
import { localDayStart, localWeekStart, localDaysBetween } from './date-local';

describe('Israel-time day/week boundaries', () => {
  it('summer (IDT, UTC+3): local midnight is 21:00 UTC the day before', () => {
    expect(localDayStart(new Date('2026-09-23T10:00:00Z')).toISOString()).toBe('2026-09-22T21:00:00.000Z');
    // 23:30 UTC is already the next local day.
    expect(localDayStart(new Date('2026-09-23T23:30:00Z')).toISOString()).toBe('2026-09-23T21:00:00.000Z');
  });

  it('winter (IST, UTC+2): local midnight is 22:00 UTC the day before', () => {
    expect(localDayStart(new Date('2026-12-15T10:00:00Z')).toISOString()).toBe('2026-12-14T22:00:00.000Z');
  });

  it('weeks start on Sunday local time', () => {
    // Wed 23 Sep 2026 → Sun 20 Sep 00:00 IDT.
    expect(localWeekStart(new Date('2026-09-23T10:00:00Z')).toISOString()).toBe('2026-09-19T21:00:00.000Z');
    // Sunday itself is day 0 of its own week.
    expect(localWeekStart(new Date('2026-09-20T09:00:00Z')).toISOString()).toBe('2026-09-19T21:00:00.000Z');
    // Saturday 23:30 UTC is already Sunday locally → a new week.
    expect(localWeekStart(new Date('2026-09-26T23:30:00Z')).toISOString()).toBe('2026-09-26T21:00:00.000Z');
  });

  it('handles the week the clocks change (IDT → IST on 25 Oct 2026)', () => {
    // Tue 27 Oct 2026 (IST) → week began Sun 25 Oct 00:00, still IDT.
    expect(localWeekStart(new Date('2026-10-27T10:00:00Z')).toISOString()).toBe('2026-10-24T21:00:00.000Z');
  });

  it('counts whole calendar days between dates', () => {
    expect(localDaysBetween('2026-09-23', '2026-11-01')).toBe(39);
    expect(localDaysBetween('2026-09-23', '2026-09-23')).toBe(0);
    expect(localDaysBetween('2026-09-23', '2026-09-20')).toBe(-3);
  });
});
