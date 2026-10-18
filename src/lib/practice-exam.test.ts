import { describe, expect, it } from 'vitest';
import { lockedFromAnswers, showPaceAnalysis } from './practice-exam';

describe('lockedFromAnswers', () => {
  it('re-locks every answered question after a reload', () => {
    expect([...lockedFromAnswers([2, null, 0, null, 3])]).toEqual([0, 2, 4]);
  });
  it('locks nothing on a fresh section', () => {
    expect(lockedFromAnswers([null, null]).size).toBe(0);
  });
});

describe('showPaceAnalysis', () => {
  const timed = [{ timings: [30, 45] }];
  it('shows for a timed exam with recorded timings', () => {
    expect(showPaceAnalysis(false, timed)).toBe(true);
  });
  it('never shows for an untimed practice run', () => {
    expect(showPaceAnalysis(true, timed)).toBe(false);
  });
  it('needs recorded timings', () => {
    expect(showPaceAnalysis(false, [{ timings: [] }, {}])).toBe(false);
  });
});
