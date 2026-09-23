import { describe, it, expect, vi } from 'vitest';
import { shuffleQuestionOptions, shuffleAllOptions, toCanonicalOption, keyPositions } from './option-shuffle';
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

describe('anti-clumping answer key (keyPositions)', () => {
  const maxSame = (key: number[]) => Math.max(...[0, 1, 2, 3].map(p => key.filter(x => x === p).length));
  const hasRun3 = (key: number[]) => key.some((p, i) => i >= 2 && p === key[i - 1] && p === key[i - 2]);

  it('never clumps: at most ⌈n/4⌉+1 per slot, never three in a row', () => {
    for (const n of [3, 4, 5, 8, 10]) {
      for (let t = 0; t < 2000; t++) {
        const key = keyPositions(n);
        expect(maxSame(key)).toBeLessThanOrEqual(Math.ceil(n / 4) + 1);
        expect(hasRun3(key)).toBe(false);
      }
    }
  });

  it('old independent draws DO clump (4+ of 5 in one slot ~6%); the new key never does', () => {
    let oldClumps = 0, newClumps = 0;
    const N = 20000;
    for (let t = 0; t < N; t++) {
      const independent = Array.from({ length: 5 }, () => Math.floor(Math.random() * 4));
      if (maxSame(independent) >= 4) oldClumps++;
      if (maxSame(keyPositions(5)) >= 4) newClumps++;
    }
    // Exact: 4·[5·(1/4)^4·(3/4) + (1/4)^5] = 6.25%
    expect(oldClumps / N).toBeGreaterThan(0.05);
    expect(oldClumps / N).toBeLessThan(0.075);
    expect(newClumps).toBe(0);
  });

  it('keeps every question’s correct position exactly uniform (symmetric constraints)', () => {
    const counts = Array.from({ length: 5 }, () => [0, 0, 0, 0]);
    const N = 40000;
    for (let t = 0; t < N; t++) keyPositions(5).forEach((p, i) => counts[i][p]++);
    for (const perSlot of counts) for (const c of perSlot) expect(c / N).toBeCloseTo(0.25, 1); // ±5pp
  });

  it('is not fully balanced — a 4-question section can repeat a slot, so the last answer can’t be deduced', () => {
    const keys = Array.from({ length: 2000 }, () => keyPositions(4));
    expect(keys.some(k => maxSame(k) === 2)).toBe(true);
    expect(keys.some(k => maxSame(k) === 1)).toBe(true);
  });

  it('uses the platform CSPRNG by default', () => {
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    keyPositions(5);
    shuffleAllOptions([question()]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('targeted shuffle', () => {
  it('lands the key on the target and still shuffles the distractors uniformly', () => {
    const seenAtSlot0 = new Set<string>();
    for (let t = 0; t < 400; t++) {
      const s = shuffleQuestionOptions(question(), undefined, 3);
      expect(s.correct_answer).toBe(3);
      expect(s.options[3].text).toBe('charlie');
      expect(toCanonicalOption(s, 3)).toBe(2);
      seenAtSlot0.add(s.options[0].text);
      // analysis stays aligned with what's on screen
      const analysis = JSON.parse(s.explanation!).options_analysis as string[];
      s.options.forEach((opt, i) => expect(analysis[i]).toContain(`about ${opt.text}`));
    }
    expect([...seenAtSlot0].sort()).toEqual(['alpha', 'bravo', 'delta']);
  });

  it('a batch whose stored keys are ALL the same slot still comes out unclumped', () => {
    const batch = Array.from({ length: 5 }, (_, i) => question({ id: `q${i}`, correct_answer: 2 }));
    for (let t = 0; t < 500; t++) {
      const served = shuffleAllOptions(batch);
      const key = served.map(q => q.correct_answer);
      expect(Math.max(...[0, 1, 2, 3].map(p => key.filter(x => x === p).length))).toBeLessThanOrEqual(3);
      served.forEach(q => expect(q.options[q.correct_answer].text).toBe('charlie'));
    }
  });
});
