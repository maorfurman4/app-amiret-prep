import { describe, expect, it } from 'vitest';
import { expectedAnswered, paceStatus } from './pace';

const sc = (elapsedSec: number, answered: number) =>
  paceStatus({ type: 'sentence_completion', elapsedSec, durationSec: 240, answered, total: 4 });
const rc = (elapsedSec: number, answered: number) =>
  paceStatus({ type: 'reading_comprehension', elapsedSec, durationSec: 900, answered, total: 5 });

describe('expectedAnswered', () => {
  it('expects nothing during the reading phase, then one per budgeted interval', () => {
    const plan = { readingSec: 240, perQuestionSec: 120 };
    expect(expectedAnswered(plan, 200, 5)).toBe(0);
    expect(expectedAnswered(plan, 480, 5)).toBe(2);
    expect(expectedAnswered(plan, 5000, 5)).toBe(5);
  });
});

describe('paceStatus', () => {
  it('stays quiet at the start until something is answered or a quarter has passed', () => {
    expect(sc(30, 0)).toBeNull();
    expect(sc(59, 0)).toBeNull();
    expect(sc(40, 1)).not.toBeNull();
  });

  it('reads sentence completion at ~60s per question', () => {
    expect(sc(120, 2)).toBe('on');
    expect(sc(120, 3)).toBe('ahead');
    expect(sc(150, 1)).toBe('behind');
  });

  it('does not count the reading phase against reading comprehension', () => {
    expect(rc(230, 0)).toBe('on');
    expect(rc(480, 2)).toBe('on');
    expect(rc(600, 1)).toBe('behind');
  });

  it('treats a fully answered section as ahead (time left to review)', () => {
    expect(sc(200, 4)).toBe('ahead');
  });

  it('has nothing to say for section types without a plan', () => {
    expect(paceStatus({ type: 'esra', elapsedSec: 100, durationSec: 240, answered: 1, total: 4 })).toBeNull();
  });
});
