import { describe, expect, it } from 'vitest';
import { suggestCause } from './error-cause';

describe('suggestCause', () => {
  it('suggests a slip for a very fast wrong answer', () => {
    expect(suggestCause('restatement', 4_000)).toBe('careless');
  });

  it('suggests time pressure past the type\'s stuck cap', () => {
    expect(suggestCause('sentence_completion', 95_000)).toBe('time');
    expect(suggestCause('sentence_completion', 80_000)).toBeNull();
    expect(suggestCause('restatement', 160_000)).toBe('time');
  });

  it('adds the reading phase for reading comprehension', () => {
    expect(suggestCause('reading_comprehension', 200_000)).toBeNull();
    expect(suggestCause('reading_comprehension', 430_000)).toBe('time');
  });

  it('suggests nothing without a usable latency', () => {
    expect(suggestCause('restatement', null)).toBeNull();
    expect(suggestCause('restatement', 0)).toBeNull();
    expect(suggestCause('restatement', 30_000)).toBeNull();
  });
});
