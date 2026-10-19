import { describe, expect, it } from 'vitest';
import { ADVANCE_AFTER_ANSWER_MS, ADVANCE_AFTER_TIMEOUT_MS, timedAdvanceDelay } from './vocab-timed';

describe('timedAdvanceDelay', () => {
  it('advances after an answer, or sooner after a timeout', () => {
    expect(timedAdvanceDelay({ mode: 'timed', selected: 2, done: false })).toBe(ADVANCE_AFTER_ANSWER_MS);
    expect(timedAdvanceDelay({ mode: 'timed', selected: -1, done: false })).toBe(ADVANCE_AFTER_TIMEOUT_MS);
  });

  it('does not advance once the student switched to another mode', () => {
    expect(timedAdvanceDelay({ mode: 'flashcard', selected: 2, done: false })).toBeNull();
    expect(timedAdvanceDelay({ mode: 'quiz', selected: -1, done: false })).toBeNull();
  });

  it('does not advance a finished run or an unanswered word', () => {
    expect(timedAdvanceDelay({ mode: 'timed', selected: 1, done: true })).toBeNull();
    expect(timedAdvanceDelay({ mode: 'timed', selected: null, done: false })).toBeNull();
  });
});
