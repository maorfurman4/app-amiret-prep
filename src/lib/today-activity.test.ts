import { describe, expect, it } from 'vitest';
import { summarizeToday } from './today-activity';

const q = (type: string, difficulty_level: number) => ({ type, difficulty_level });

describe('summarizeToday', () => {
  it('is empty for a day with no answers', () => {
    expect(summarizeToday([])).toEqual({ answered: 0, correct: 0, timeMs: 0, byType: [] });
  });

  it('counts answers, accuracy, level range per type, most-answered first', () => {
    const s = summarizeToday([
      { correct: true, latency_ms: 30_000, questions: q('restatement', 3) },
      { correct: true, latency_ms: 20_000, questions: q('sentence_completion', 2) },
      { correct: false, latency_ms: 10_000, questions: [q('sentence_completion', 4)] },
      { correct: true, latency_ms: 5_000, questions: q('sentence_completion', 3) },
    ]);
    expect(s.answered).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.timeMs).toBe(65_000);
    expect(s.byType).toEqual([
      { type: 'sentence_completion', answered: 3, correct: 2, minLevel: 2, maxLevel: 4 },
      { type: 'restatement', answered: 1, correct: 1, minLevel: 3, maxLevel: 3 },
    ]);
  });

  it('caps an item left open, and still counts an answer whose question is gone', () => {
    const s = summarizeToday([
      { correct: true, latency_ms: 60 * 60_000, questions: q('restatement', 3) },
      { correct: false, latency_ms: null, questions: null },
    ]);
    expect(s.timeMs).toBe(3 * 60_000);
    expect(s.answered).toBe(2);
    expect(s.byType).toHaveLength(1);
  });
});
