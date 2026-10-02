import { describe, expect, it } from 'vitest';
import { SECTION_CONFIGS } from '@/types/exam';
import { binomialUpperTail, examEffort, isLowEffortExam, isRapidGuess } from './exam-effort';

/**
 * A full 7-section exam (23 scored items + 4 experimental) in the shape
 * section_results stores: per-question answers, the section's correct
 * count and per-question seconds. `right(n)` marks the first n scored
 * items correct, in exam order.
 */
function exam({ seconds, right, timings = true }: { seconds: number; right: number; timings?: boolean }) {
  let scoredSeen = 0;
  return SECTION_CONFIGS.map(cfg => {
    const answers = Array.from({ length: cfg.questionCount }, () => {
      if (cfg.experimental) return 1;
      return scoredSeen++ < right ? 0 : 1; // 0 = the key
    });
    return {
      sectionIndex: cfg.index,
      type: cfg.type,
      answers,
      correctCount: answers.filter(a => a === 0).length,
      totalCount: cfg.questionCount,
      ...(timings ? { timings: answers.map(() => seconds) } : {}),
    };
  });
}

describe('isRapidGuess', () => {
  it('is under 5% of the type budget', () => {
    expect(isRapidGuess('sentence_completion', 2_000)).toBe(true); // < 3 s
    expect(isRapidGuess('sentence_completion', 3_000)).toBe(false);
    expect(isRapidGuess('reading_comprehension', 8_000)).toBe(true); // < 9 s
    expect(isRapidGuess('restatement', null)).toBe(false);
  });
});

describe('binomialUpperTail', () => {
  it('matches exact binomial tails', () => {
    expect(binomialUpperTail(0, 23, 0.25)).toBe(1);
    expect(binomialUpperTail(24, 23, 0.25)).toBe(0);
    expect(binomialUpperTail(1, 1, 0.25)).toBeCloseTo(0.25, 12);
    expect(binomialUpperTail(2, 2, 0.5)).toBeCloseTo(0.25, 12);
    // 23 items at p = .25: 10+ right is the first count significant at 5%.
    expect(binomialUpperTail(9, 23, 0.25)).toBeGreaterThan(0.05);
    expect(binomialUpperTail(10, 23, 0.25)).toBeLessThan(0.05);
  });
});

describe('examEffort', () => {
  it('flags an exam clicked through at chance (the production 1-second exams)', () => {
    const e = examEffort(exam({ seconds: 1, right: 6 }));
    expect(e).toMatchObject({ answered: 23, timed: 23, rapid: 23, correct: 6, lowEffort: true });
  });

  it('never flags a fast exam that is also right — speed alone is fluency', () => {
    expect(isLowEffortExam(exam({ seconds: 1, right: 20 }))).toBe(false);
    // Right at the significance line: 10/23 is already better than guessing.
    expect(isLowEffortExam(exam({ seconds: 1, right: 10 }))).toBe(false);
    expect(isLowEffortExam(exam({ seconds: 1, right: 9 }))).toBe(true);
  });

  it('never flags a slow exam, however low — a weak score from real effort is a real score', () => {
    expect(isLowEffortExam(exam({ seconds: 40, right: 3 }))).toBe(false);
  });

  it('never flags an exam stored without timings', () => {
    expect(isLowEffortExam(exam({ seconds: 1, right: 0, timings: false }))).toBe(false);
  });

  it('needs most answers to be rapid, not just a rushed ending', () => {
    // Reading (9 s threshold) answered in 5 s, everything else in 30 s:
    // 5 of 23 answers are rapid — a minority.
    const rows = exam({ seconds: 30, right: 4 }).map(sr =>
      sr.type === 'reading_comprehension' ? { ...sr, timings: sr.answers.map(() => 5) } : sr);
    expect(examEffort(rows)).toMatchObject({ rapid: 5, lowEffort: false });
  });

  it('ignores the experimental section and blank answers', () => {
    const rows = exam({ seconds: 1, right: 6 }).map(sr =>
      sr.sectionIndex === 7 ? { ...sr, timings: sr.answers.map(() => 100) } : sr);
    expect(examEffort(rows).rapid).toBe(23);
    const blanks = exam({ seconds: 1, right: 6 }).map(sr => ({ ...sr, answers: sr.answers.map(() => null), correctCount: 0 }));
    expect(examEffort(blanks)).toMatchObject({ answered: 0, rapid: 0, lowEffort: false });
  });

  it('tolerates junk input', () => {
    expect(examEffort(null).lowEffort).toBe(false);
    expect(examEffort('nope').answered).toBe(0);
  });
});
