import { describe, it, expect } from 'vitest';
import {
  irtProbability,
  estimateThetaEAP,
  estimateThetaMLE,
  routeNextDifficulty,
  thetaToScore,
  updateThetaAfterSection,
  correctCount,
} from './adaptive';
import { classifyScore, SECTION_CONFIGS, isExperimentalSection, type Question } from '@/types/exam';

const item = (b: number, a = 1.4, c = 0.25) => ({ a, b, c });

describe('irtProbability (3PL)', () => {
  it('equals c + (1-c)/2 when theta = b', () => {
    expect(irtProbability(0, item(0))).toBeCloseTo(0.25 + 0.75 / 2, 10);
  });
  it('is monotonically increasing in theta', () => {
    let prev = 0;
    for (let t = -3; t <= 3; t += 0.5) {
      const p = irtProbability(t, item(0));
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });
  it('never drops below the guessing floor c', () => {
    expect(irtProbability(-3, item(3))).toBeGreaterThanOrEqual(0.25);
  });
});

describe('thetaToScore', () => {
  it('maps theta linearly: 0→100', () => expect(thetaToScore(0)).toBe(100));
  it('clamps top at 150', () => expect(thetaToScore(3)).toBe(150));
  it('clamps bottom at 50', () => expect(thetaToScore(-3)).toBe(50));
  it('134 (exemption line) needs theta 1.7', () => expect(thetaToScore(1.7)).toBe(134));
  it('handles non-finite input safely', () => expect(thetaToScore(NaN)).toBe(100));
});

describe('routeNextDifficulty', () => {
  it.each([
    [1.5, 5], [2.9, 5],
    [0.5, 4], [1.49, 4],
    [-0.5, 3], [0.49, 3], [0, 3],
    [-1.5, 2], [-0.51, 2],
    [-2.9, 1], [-1.51, 1],
  ])('theta %f → level %i', (t, lvl) => {
    expect(routeNextDifficulty(t)).toBe(lvl);
  });
  it('defaults to 3 on non-finite theta', () => {
    expect(routeNextDifficulty(NaN)).toBe(3);
    expect(routeNextDifficulty(Infinity)).toBe(3);
  });
});

describe('estimateThetaEAP', () => {
  it('is positive when all answers on hard items are correct', () => {
    const items = [item(1), item(1.5), item(2), item(2.5)];
    expect(estimateThetaEAP(items, [1, 1, 1, 1])).toBeGreaterThan(0.8);
  });
  it('is negative when everything is wrong on easy items', () => {
    const items = [item(-2), item(-1.5), item(-1), item(-0.5)];
    expect(estimateThetaEAP(items, [0, 0, 0, 0])).toBeLessThan(-0.8);
  });
  it('stays within [-3, 3]', () => {
    const items = Array.from({ length: 30 }, () => item(3, 1.8));
    expect(estimateThetaEAP(items, items.map(() => 1))).toBeLessThanOrEqual(3);
  });
});

describe('estimateThetaMLE', () => {
  it('falls back to EAP on a perfect score', () => {
    const items = [item(0), item(0.5), item(1)];
    expect(estimateThetaMLE(0, items, [1, 1, 1])).toBeCloseTo(estimateThetaEAP(items, [1, 1, 1]), 10);
  });
  it('falls back to EAP on a zero score', () => {
    const items = [item(0), item(0.5), item(1)];
    expect(estimateThetaMLE(0, items, [0, 0, 0])).toBeCloseTo(estimateThetaEAP(items, [0, 0, 0]), 10);
  });
  it('recovers a known ability from deterministic responses', () => {
    // 27 items spread like a full exam; responses = 1 where P(theta_true) > 0.5
    const trueTheta = 0.8;
    const items = Array.from({ length: 27 }, (_, i) => item(-2.5 + (5 * i) / 26));
    const resp = items.map(it_ => (irtProbability(trueTheta, it_) > 0.5 ? 1 : 0));
    const est = estimateThetaMLE(0, items, resp);
    expect(Math.abs(est - trueTheta)).toBeLessThan(0.6);
  });
  it('estimate increases with more correct answers', () => {
    const items = Array.from({ length: 8 }, (_, i) => item(-1.5 + 0.4 * i));
    const low = estimateThetaMLE(0, items, [1, 1, 1, 0, 0, 0, 0, 0]);
    const high = estimateThetaMLE(0, items, [1, 1, 1, 1, 1, 1, 0, 0]);
    expect(high).toBeGreaterThan(low);
  });
});

describe('section helpers', () => {
  const qs = [
    { correct_answer: 0, a: 1.4, b: 0, c: 0.25 },
    { correct_answer: 2, a: 1.4, b: 0, c: 0.25 },
    { correct_answer: 1, a: 1.4, b: 0, c: 0.25 },
  ] as unknown as Question[];

  it('correctCount counts matches and treats null as wrong', () => {
    expect(correctCount({ questions: qs, answers: [0, 2, 1] })).toBe(3);
    expect(correctCount({ questions: qs, answers: [0, null, 3] })).toBe(1);
  });

  it('updateThetaAfterSection treats null answers as wrong', () => {
    const allNull = updateThetaAfterSection(0, { questions: qs, answers: [null, null, null] });
    const allRight = updateThetaAfterSection(0, { questions: qs, answers: [0, 2, 1] });
    expect(allRight).toBeGreaterThan(allNull);
  });
});

describe('exam structure (must match the official AMIRNET format)', () => {
  it('has exactly 7 sections', () => expect(SECTION_CONFIGS).toHaveLength(7));
  it('has 3 SC + 1 RC + 2 RST scored sections + 1 experimental', () => {
    const scored = SECTION_CONFIGS.filter(s => !s.experimental);
    expect(scored.filter(s => s.type === 'sentence_completion')).toHaveLength(3);
    expect(scored.filter(s => s.type === 'reading_comprehension')).toHaveLength(1);
    expect(scored.filter(s => s.type === 'restatement')).toHaveLength(2);
    expect(SECTION_CONFIGS.filter(s => s.experimental)).toHaveLength(1);
  });
  it('uses official timing: SC 4q/240s, RST 3q/360s, RC 5q/900s', () => {
    for (const s of SECTION_CONFIGS) {
      if (s.type === 'sentence_completion') { expect(s.questionCount).toBe(4); expect(s.durationSeconds).toBe(240); }
      if (s.type === 'restatement') { expect(s.questionCount).toBe(3); expect(s.durationSeconds).toBe(360); }
      if (s.type === 'reading_comprehension') { expect(s.questionCount).toBe(5); expect(s.durationSeconds).toBe(900); }
    }
  });
  it('experimental is only section 7', () => {
    expect(isExperimentalSection(7)).toBe(true);
    for (let i = 1; i <= 6; i++) expect(isExperimentalSection(i)).toBe(false);
  });
});

describe('classifyScore bands', () => {
  it.each([
    [150, 'פטור מלא'], [134, 'פטור מלא'],
    [133, "מתקדמים ב'"], [120, "מתקדמים ב'"],
    [119, "מתקדמים א'"], [100, "מתקדמים א'"],
    [99, 'בסיסי'], [85, 'בסיסי'],
    [84, "טרום-בסיסי ב'"], [70, "טרום-בסיסי ב'"],
    [69, "טרום-בסיסי א'"], [50, "טרום-בסיסי א'"],
  ])('score %i → %s', (score, label) => {
    expect(classifyScore(score).label).toBe(label);
  });
});
