import { describe, it, expect } from 'vitest';
import {
  sessionMeasurement, pooledMeasurement, scoreInterval, exemptionTone, formatProbability, INTERVAL_Z,
  currentEstimate, consistentWithLatest, CONSISTENCY_Z,
} from './exemption';
import { exemptionProbability, standardError, CUT_THETA } from './calibration';
import type { Question } from '@/types/exam';

const q = (b: number): Question => ({
  id: `q${b}`, type: 'sentence_completion', text: '', options: [], correct_answer: 0,
  a: 1.2, b, c: 0.25, difficulty_level: 3,
});
const sections = (n: number, b: number) =>
  Array.from({ length: n }, (_, i) => ({ sectionIndex: i + 1, questions: [q(b), q(b), q(b), q(b)], answers: [0, 0, 0, 0] }));

describe('sessionMeasurement', () => {
  it('uses the stored values when the exam has them', () => {
    expect(sessionMeasurement({ theta_final: 1.2, theta_se: 0.4, p_exempt: 0.11 })).toEqual({ theta: 1.2, se: 0.4, p: 0.11 });
  });

  it('re-derives legacy exams exactly as the server would (scored sections only)', () => {
    const results = sections(7, 1); // section 7 is experimental → excluded
    const m = sessionMeasurement({ theta_final: 1.4, section_results: results })!;
    const scored = results.slice(0, 6).flatMap(s => s.questions);
    expect(m.se).toBeCloseTo(standardError(1.4, scored), 12);
    expect(m.p).toBeCloseTo(exemptionProbability(1.4, m.se), 12);
  });

  it('returns null when there is nothing to measure from', () => {
    expect(sessionMeasurement({ theta_final: null })).toBeNull();
    expect(sessionMeasurement({ theta_final: 1, section_results: [] })).toBeNull();
  });
});

describe('pooledMeasurement', () => {
  it('is precision-weighted: the more precise exam dominates, and SE shrinks', () => {
    const m = pooledMeasurement([
      { theta: 1.0, se: 0.3, p: 0 },
      { theta: 2.0, se: 0.6, p: 0 },
    ])!;
    // weights 1/.09 and 1/.36 → θ̄ = (1/.09 + 2/.36) / (1/.09 + 1/.36) = 1.2
    expect(m.theta).toBeCloseTo(1.2, 10);
    expect(m.se).toBeCloseTo(1 / Math.sqrt(1 / 0.09 + 1 / 0.36), 10);
    expect(m.se).toBeLessThan(0.3);
    expect(m.p).toBeCloseTo(exemptionProbability(m.theta, m.se), 12);
  });

  it('three equal exams at the cut → still 50%, but with √3 less uncertainty', () => {
    const m = pooledMeasurement(Array(3).fill({ theta: CUT_THETA, se: 0.45, p: 0.5 }))!;
    expect(m.p).toBeCloseTo(0.5, 7);
    expect(m.se).toBeCloseTo(0.45 / Math.sqrt(3), 10);
  });

  it('handles nothing usable', () => {
    expect(pooledMeasurement([])).toBeNull();
    expect(pooledMeasurement([{ theta: 1, se: Infinity, p: 0 }])).toBeNull();
  });
});

describe('display helpers', () => {
  it('score interval is θ̂ ± 1.28·SE on the 50–150 scale', () => {
    expect(INTERVAL_Z).toBeCloseTo(1.2816, 4);
    expect(scoreInterval({ theta: 1.2, se: 0.45 })).toEqual({ lo: 112, hi: 136 });
    expect(scoreInterval({ theta: 3, se: 1 })).toEqual({ lo: 134, hi: 150 }); // clamped
  });

  it('tones: ≥70% likely, 30–70% close, <30% building', () => {
    expect([0.95, 0.7, 0.69, 0.3, 0.29, 0].map(exemptionTone)).toEqual(['likely', 'likely', 'close', 'close', 'building', 'building']);
  });

  it('never claims certainty', () => {
    expect([0.72, 0.999, 0.001, 0.5].map(formatProbability)).toEqual(['72%', '>99%', '<1%', '50%']);
  });
});

describe('currentEstimate — combine only exams consistent with the latest', () => {
  // θ = (score − 100) / 20; each single exam SE ≈ 0.42 (±8 points).
  const exam = (score: number, se = 0.42) => ({ theta: (score - 100) / 20, se, p: 0 });

  it('a genuine breakthrough (112 → 138) is reflected immediately', () => {
    const cur = currentEstimate([exam(110), exam(112), exam(138)])!;
    expect(cur.dropped).toBe(2);
    expect(cur.used).toBe(1);
    expect(cur.measurement.theta).toBeCloseTo(1.9, 10);
    expect(cur.measurement.p).toBeCloseTo(exemptionProbability(1.9, 0.42), 10);
  });

  it('normal noise is still smoothed: nothing dropped, SE shrinks', () => {
    const cur = currentEstimate([exam(133), exam(128), exam(131)])!;
    expect(cur.dropped).toBe(0);
    expect(cur.used).toBe(3);
    expect(cur.measurement.se).toBeLessThan(0.42 / Math.sqrt(2));
  });

  it('a steady 127 → 131 → 138 climb is within single-exam noise, so all three pool', () => {
    // Gaps of 11 and 7 points are 0.9 and 0.6 combined SEs — not "clearly"
    // below at the one-sided 95% line (1.645). The estimate stays pooled.
    const cur = currentEstimate([exam(127, 0.43), exam(131, 0.42), exam(138, 0.41)])!;
    expect(cur.dropped).toBe(0);
    expect(Math.round(cur.measurement.p * 100)).toBe(35);
  });

  it('drops only the clearly-lower exams and keeps the consistent ones', () => {
    const cur = currentEstimate([exam(105), exam(132), exam(138)])!;
    expect(cur.dropped).toBe(1);
    expect(cur.used).toBe(2);
  });

  it('is one-sided: a weaker latest exam is smoothed by the stronger ones before it', () => {
    const cur = currentEstimate([exam(140), exam(141), exam(118)])!;
    expect(cur.dropped).toBe(0);
    expect(cur.measurement.theta).toBeGreaterThan((118 - 100) / 20);
  });

  it('only looks at the last POOL_WINDOW exams', () => {
    const cur = currentEstimate([exam(60), exam(60), exam(135), exam(136), exam(137)])!;
    expect(cur).toMatchObject({ used: 3, dropped: 0 });
  });

  it('the exact threshold: 1.645 combined SEs', () => {
    const se = 0.4;
    const gap = CONSISTENCY_Z * Math.sqrt(2) * se;
    expect(consistentWithLatest([{ theta: 1 - gap + 1e-9, se, p: 0 }, { theta: 1, se, p: 0 }])).toHaveLength(2);
    expect(consistentWithLatest([{ theta: 1 - gap - 1e-9, se, p: 0 }, { theta: 1, se, p: 0 }])).toHaveLength(1);
  });
});
