import { describe, expect, it } from 'vitest';
import { countCorrect, restoreQuestion } from './review-session';
import type { Question } from '@/types/exam';

const q = (id: string, correct = 0): Question => ({
  id,
  type: 'sentence_completion',
  text: `${id} ___`,
  options: ['a', 'b', 'c', 'd'].map((text, i) => ({ id: `${id}${i}`, text })),
  correct_answer: correct,
  a: 1, b: 0, c: 0.25,
  difficulty_level: 3,
});

describe('countCorrect', () => {
  it('counts only questions still in the round (removing one never gives 2/1)', () => {
    const [q1, q2] = [q('q1', 0), q('q2', 1)];
    // Q1 answered correctly, then removed; Q2 answered correctly.
    expect(countCorrect([q2], [1])).toBe(1);
    expect(countCorrect([q1, q2], [0, 1])).toBe(2);
  });

  it('ignores blanks and wrong answers', () => {
    expect(countCorrect([q('q1', 0), q('q2', 1), q('q3', 2)], [0, null, 3])).toBe(1);
  });
});

describe('restoreQuestion', () => {
  const before = [q('a'), q('b'), q('c'), q('d')];

  it('puts a failed removal back in its old place', () => {
    expect(restoreQuestion([q('a'), q('c'), q('d')], before, 'b').map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(restoreQuestion([q('b'), q('c'), q('d')], before, 'a').map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps its place when others were removed meanwhile', () => {
    expect(restoreQuestion([q('d')], before, 'c').map(x => x.id)).toEqual(['c', 'd']);
  });

  it('does nothing if it is already there', () => {
    const current = [q('a'), q('b')];
    expect(restoreQuestion(current, before, 'b')).toBe(current);
  });
});
