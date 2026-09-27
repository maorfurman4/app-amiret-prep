import { describe, expect, it } from 'vitest';
import { shouldShowResultsPrompt } from './official-score';

const now = new Date('2026-09-26T12:00:00Z');
const base = { completedExams: 1, hasReports: false, dismissedAt: null, now };

describe('shouldShowResultsPrompt', () => {
  it('shows on the 1st, 6th and 11th completed exam only', () => {
    const shown = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12].filter(n => shouldShowResultsPrompt({ ...base, completedExams: n }));
    expect(shown).toEqual([1, 6, 11]);
  });

  it('never shows once the student has reported a score', () => {
    expect(shouldShowResultsPrompt({ ...base, hasReports: true })).toBe(false);
  });

  it('respects "prefer not to" for 60 days', () => {
    expect(shouldShowResultsPrompt({ ...base, completedExams: 6, dismissedAt: '2026-09-01T00:00:00Z' })).toBe(false);
    expect(shouldShowResultsPrompt({ ...base, completedExams: 6, dismissedAt: '2026-07-01T00:00:00Z' })).toBe(true);
  });

  it('does not show before any exam', () => {
    expect(shouldShowResultsPrompt({ ...base, completedExams: 0 })).toBe(false);
  });
});
