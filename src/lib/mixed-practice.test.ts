import { describe, expect, it } from 'vitest';
import {
  EXAM_MIX, MIXED_DEFAULT, MIXED_LIMITS, MIXED_PRESETS, RC_PER_PASSAGE,
  interleaveMixed, parseMixedPlan, planIsValid, planMinutes, planQuestionCount,
} from './mixed-practice';

const params = (q: string) => new URLSearchParams(q);

describe('exam-derived numbers', () => {
  it('reads the exam mix off SECTION_CONFIGS: 12 SC, 6 restatement, 1 passage of 5', () => {
    expect(EXAM_MIX).toEqual({ sc: 12, rs: 6, rc: 1 });
    expect(RC_PER_PASSAGE).toBe(5);
  });

  it('scales the presets down from the exam mix, never below one passage', () => {
    expect(MIXED_PRESETS.map(p => [p.id, p.plan])).toEqual([
      ['full', { sc: 12, rs: 6, rc: 1 }],
      ['half', { sc: 6, rs: 3, rc: 1 }],
      ['short', { sc: 4, rs: 2, rc: 1 }],
    ]);
    expect(MIXED_DEFAULT).toEqual({ sc: 6, rs: 3, rc: 1 });
  });

  it('estimates time at the exam section pace (full mix = the 6 core sections)', () => {
    expect(planMinutes(EXAM_MIX)).toBe(39);
    expect(planMinutes(MIXED_DEFAULT)).toBe(27);
  });
});

describe('parseMixedPlan', () => {
  it('defaults when no per-type params are sent', () => {
    expect(parseMixedPlan(params('count=10'))).toEqual(MIXED_DEFAULT);
  });

  it('reads the counts, treating a missing type as 0', () => {
    expect(parseMixedPlan(params('sc=4&rs=3&rc=1'))).toEqual({ sc: 4, rs: 3, rc: 1 });
    expect(parseMixedPlan(params('rs=5'))).toEqual({ sc: 0, rs: 5, rc: 0 });
  });

  it('clamps each type to its limit', () => {
    expect(parseMixedPlan(params('sc=99&rs=-3&rc=9'))).toEqual({ sc: 12, rs: 0, rc: 2 });
  });

  it('rejects an empty mix and one over the total cap', () => {
    expect(parseMixedPlan(params('sc=0&rs=0&rc=0'))).toBeNull();
    expect(parseMixedPlan(params('sc=abc'))).toBeNull();
    expect(parseMixedPlan(params('sc=12&rs=12&rc=2'))).toBeNull(); // 34 > 30
  });

  it('accepts exactly the cap', () => {
    const plan = { sc: 12, rs: 8, rc: 2 };
    expect(planQuestionCount(plan)).toBe(MIXED_LIMITS.total);
    expect(planIsValid(plan)).toBe(true);
  });
});

describe('interleaveMixed', () => {
  const sc = (n: number) => Array.from({ length: n }, (_, i) => `S${i}`);
  const rs = (n: number) => Array.from({ length: n }, (_, i) => `R${i}`);
  const passage = (id: string) => Array.from({ length: 5 }, (_, i) => `${id}${i}`);
  const kinds = (out: string[]) => out.map(x => x[0]).join('');

  it('serves exactly what it was given', () => {
    const out = interleaveMixed(sc(4), rs(3), [passage('P')]);
    expect(out).toHaveLength(12);
    expect([...out].sort()).toEqual([...sc(4), ...rs(3), ...passage('P')].sort());
  });

  it('keeps every passage contiguous and in its original order', () => {
    for (let run = 0; run < 50; run++) {
      const out = interleaveMixed(sc(6), rs(3), [passage('P'), passage('Q')]);
      for (const id of ['P', 'Q']) {
        const start = out.indexOf(`${id}0`);
        expect(out.slice(start, start + 5)).toEqual(passage(id));
      }
    }
  });

  it('places a single passage mid-session, never first or last', () => {
    const out = interleaveMixed(sc(6), rs(3), [passage('P')]);
    const start = out.indexOf('P0');
    expect(start).toBeGreaterThan(0);
    expect(start + 5).toBeLessThan(out.length);
    expect(Math.abs(start - (out.length - 5) / 2)).toBeLessThanOrEqual(1);
  });

  it('spreads SC and restatement by ratio, with no long single-type run', () => {
    for (let run = 0; run < 50; run++) {
      const out = kinds(interleaveMixed(sc(6), rs(3), []));
      expect(out).not.toMatch(/RR/);
      expect(out).not.toMatch(/SSS/);
    }
  });

  it('leaves out a type set to 0', () => {
    expect(kinds(interleaveMixed(sc(0), rs(4), [passage('P')]))).toBe('RRPPPPPRR');
    expect(kinds(interleaveMixed(sc(3), rs(0), []))).toBe('SSS');
    expect(interleaveMixed([], [], [passage('P'), passage('Q')])).toEqual([...passage('P'), ...passage('Q')]);
  });

  it('skips empty passage blocks (a passage that came back without questions)', () => {
    expect(kinds(interleaveMixed(sc(2), rs(0), [[]]))).toBe('SS');
  });
});
