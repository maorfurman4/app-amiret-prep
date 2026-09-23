import { describe, it, expect } from 'vitest';
import { shuffleQuestionOptions, shuffleAllOptions, toCanonicalOption } from './option-shuffle';
import { isCorrectAnswer, type Question } from '@/types/exam';

const question = (overrides: Partial<Question> = {}): Question => ({
  id: 'q1',
  type: 'sentence_completion',
  text: 'The results were ___ .',
  options: ['alpha', 'bravo', 'charlie', 'delta'].map((text, i) => ({ id: 'abcd'[i], text })),
  correct_answer: 2,
  explanation: JSON.stringify({
    strategy: 's',
    correct_reason: 'r',
    options_analysis: ['about alpha', 'about bravo', 'נכון! about charlie', 'about delta'],
  }),
  a: 1.2, b: 0, c: 0.25, difficulty_level: 3,
  ...overrides,
});

/** Deterministic RNG from a fixed sequence, for exact permutations. */
const seq = (values: number[]) => { let i = 0; return () => values[i++ % values.length]; };

describe('shuffleQuestionOptions', () => {
  it('produces a permutation of the original options', () => {
    const q = question();
    const s = shuffleQuestionOptions(q, seq([0.9, 0.1, 0.5]));
    expect([...s.option_order].sort()).toEqual([0, 1, 2, 3]);
    expect(s.options).toEqual(s.option_order.map(i => q.options[i]));
  });

  it('keeps the same option text correct after shuffling', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = shuffleQuestionOptions(question(), seq([((seed * 37) % 100) / 100, ((seed * 53) % 100) / 100, ((seed * 11) % 100) / 100]));
      expect(s.options[s.correct_answer].text).toBe('charlie');
      expect(isCorrectAnswer(s, s.correct_answer)).toBe(true);
    }
  });

  it('realigns options_analysis with the displayed order', () => {
    const s = shuffleQuestionOptions(question(), seq([0.2, 0.7, 0.4]));
    const analysis = JSON.parse(s.explanation!).options_analysis as string[];
    s.options.forEach((opt, i) => expect(analysis[i]).toContain(`about ${opt.text}`));
    expect(analysis[s.correct_answer]).toMatch(/^נכון!/);
  });

  it('leaves a non-JSON or misaligned explanation untouched', () => {
    expect(shuffleQuestionOptions(question({ explanation: 'plain text' })).explanation).toBe('plain text');
    const short = JSON.stringify({ correct_reason: 'r', options_analysis: ['only one'] });
    expect(shuffleQuestionOptions(question({ explanation: short })).explanation).toBe(short);
  });

  it('does not mutate the source question', () => {
    const q = question();
    const snapshot = JSON.stringify(q);
    shuffleQuestionOptions(q, seq([0, 0, 0]));
    expect(JSON.stringify(q)).toBe(snapshot);
  });

  it('actually varies the order across serves', () => {
    const orders = new Set(Array.from({ length: 200 }, () => shuffleQuestionOptions(question()).option_order.join('')));
    expect(orders.size).toBeGreaterThan(10);
  });

  it('shuffles each question in a list independently', () => {
    const list = shuffleAllOptions([question({ id: 'a' }), question({ id: 'b' })]);
    expect(list.map(q => q.id)).toEqual(['a', 'b']);
    list.forEach(q => expect(q.option_order).toHaveLength(4));
  });
});

describe('toCanonicalOption', () => {
  it('maps every displayed index back to its stored index', () => {
    const q = question();
    const s = shuffleQuestionOptions(q, seq([0.3, 0.8, 0.6]));
    s.options.forEach((opt, displayIdx) => {
      expect(q.options[toCanonicalOption(s, displayIdx)!]).toEqual(opt);
    });
    // The displayed correct answer maps back to the stored key.
    expect(toCanonicalOption(s, s.correct_answer)).toBe(q.correct_answer);
  });

  it('is the identity for an unshuffled question and keeps blanks blank', () => {
    expect(toCanonicalOption(question(), 3)).toBe(3);
    expect(toCanonicalOption(shuffleQuestionOptions(question()), null)).toBeNull();
  });
});
