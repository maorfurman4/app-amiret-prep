import { describe, expect, it } from 'vitest';
import { optionWords, pickDistinctOptions, usedOptionWords } from './option-overlap';

const q = (id: string, ...opts: string[]) => ({ id, options: opts.map(text => ({ text })) });

// The three questions from the reported exam: one templated batch.
const composed = q('composed', 'trivial', 'vague', 'frugal', 'composed');
const profound = q('profound', 'profound', 'trivial', 'frugal', 'vague');
const insufficient = q('insufficient', 'frugal', 'genuine', 'eloquent', 'insufficient');
const clean1 = q('c1', 'expand', 'reduce', 'ignore', 'predict');
const clean2 = q('c2', 'reluctant', 'eager', 'curious', 'hostile');

describe('pickDistinctOptions', () => {
  it('never puts two questions that share a choice in one set', () => {
    const set = pickDistinctOptions([composed, profound, insufficient, clean1, clean2], 3);
    expect(set.map(x => x.id)).toEqual(['composed', 'c1', 'c2']);
    const words = set.flatMap(optionWords);
    expect(new Set(words).size).toBe(words.length);
  });

  it('keeps the caller order (ranking and randomness stay theirs)', () => {
    expect(pickDistinctOptions([clean2, clean1, composed], 3).map(x => x.id)).toEqual(['c2', 'c1', 'composed']);
  });

  it('avoids words already used earlier in the exam', () => {
    const set = pickDistinctOptions([composed, clean1], 1, usedOptionWords([insufficient]));
    expect(set.map(x => x.id)).toEqual(['c1']); // composed shares "frugal" with an earlier section
  });

  it('fills a short pool with the least-overlapping questions instead of coming up short', () => {
    const set = pickDistinctOptions([composed, profound, insufficient], 3);
    expect(set).toHaveLength(3);
    expect(set[0].id).toBe('composed');
  });

  it('ignores sentence-length options (restatement)', () => {
    const r1 = q('r1', 'The city built a new park.', 'The park was closed for years.', 'No one visits the park.', 'The park is new.');
    const r2 = q('r2', 'The city built a new park.', 'A b c d e.', 'F g h i j.', 'K l m n o.');
    expect(optionWords(r1)).toEqual([]);
    expect(pickDistinctOptions([r1, r2], 2).map(x => x.id)).toEqual(['r1', 'r2']);
  });

  it('compares case- and space-insensitively and counts short phrases', () => {
    expect(optionWords(q('x', ' Frugal ', 'in  spite of', 'a very long option here'))).toEqual(['frugal', 'in spite of']);
  });
});
