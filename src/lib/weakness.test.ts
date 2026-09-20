import { describe, expect, it } from 'vitest';
import { computeWeakestType } from './weakness';

function section(sectionIndex: number, correctCount: number, totalCount: number) {
  return { sectionIndex, type: 'sentence_completion', correctCount, totalCount };
}

describe('computeWeakestType', () => {
  it('returns null when there are no completed sessions', () => {
    expect(computeWeakestType([])).toBeNull();
  });

  it('returns null when no session has any section results', () => {
    expect(computeWeakestType([{ score: 100, section_results: [] }])).toBeNull();
  });

  it('picks the type with the lowest accuracy across recent sessions', () => {
    const result = computeWeakestType([
      {
        score: 110,
        section_results: [
          { sectionIndex: 1, type: 'sentence_completion', correctCount: 4, totalCount: 4 },
          { sectionIndex: 4, type: 'restatement', correctCount: 1, totalCount: 3 },
        ],
      },
    ]);
    expect(result?.type).toBe('restatement');
    expect(result?.accuracy).toBeCloseTo(1 / 3);
  });

  it('only looks at the last 10 sessions', () => {
    const oldBad = Array.from({ length: 5 }, () => ({
      score: 100,
      section_results: [{ sectionIndex: 4, type: 'restatement', correctCount: 0, totalCount: 3 }],
    }));
    const recentGood = Array.from({ length: 10 }, () => ({
      score: 130,
      section_results: [{ sectionIndex: 4, type: 'restatement', correctCount: 3, totalCount: 3 }],
    }));
    const result = computeWeakestType([...oldBad, ...recentGood]);
    expect(result?.accuracy).toBe(1);
  });

  it('derives the practice level from the most recent score', () => {
    const lowScore = computeWeakestType([{ score: 60, section_results: [section(1, 1, 4)] }]);
    const highScore = computeWeakestType([{ score: 140, section_results: [section(1, 1, 4)] }]);
    expect(lowScore!.level).toBeLessThan(highScore!.level);
  });
});
