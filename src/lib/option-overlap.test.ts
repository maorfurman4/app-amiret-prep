import { describe, expect, it } from 'vitest';
import { optionWords, perLevelForRandomSet, pickDistinctOptions, usedOptionWords } from './option-overlap';

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

describe('built practice sets', () => {
  // Seeded so a failure reproduces; mulberry32.
  const rng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = <T,>(xs: T[], r: () => number) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // 80 questions per level drawing 3 of their 4 choices from a shared
  // 150-word vocabulary (each word in ~8 questions — denser than the real SC
  // pool's ~2.6), plus the reported item and others sharing "diminish".
  const r = rng(42);
  const vocab = Array.from({ length: 150 }, (_, i) => `word${i}`);
  const levels = Array.from({ length: 5 }, (_, lv) => [
    ...(lv === 1 ? [q('2a3c7919', 'embellish', 'demolish', 'diminish', 'advertise')] : []),
    ...Array.from({ length: 80 }, (_, i) =>
      q(`L${lv}-${i}`, ...shuffle(vocab, r).slice(0, 3), i < 6 ? 'diminish' : `own${lv}-${i}`)),
  ]);

  // Mirrors /api/practice/questions random mode: a distinct pick per level, then one across levels.
  const buildRandomSet = (count: number, r: () => number) => {
    const perLevel = perLevelForRandomSet(count);
    const pool = levels.flatMap(lv => pickDistinctOptions(shuffle(lv, r).slice(0, perLevel * 6), perLevel));
    return pickDistinctOptions(shuffle(pool, r), count);
  };

  it.each([5, 10])('every option word is unique across a %i-question set', count => {
    const r = rng(count);
    for (let run = 0; run < 400; run++) {
      const set = buildRandomSet(count, r);
      expect(set).toHaveLength(count);
      const words = set.flatMap(optionWords);
      expect(words.length - new Set(words).size, `run ${run}: ${set.map(x => x.id).join(',')}`).toBe(0);
    }
  });
});
