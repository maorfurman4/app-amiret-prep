import { describe, it, expect } from 'vitest';
import {
  CUT_THETA, fisherInformation, testInformation, standardError, chooseRouteTarget,
  normalCdf, exemptionProbability, eloStep, ELO_K0, B_BOUND,
} from './calibration';
import { irtProbability, itemIrtParams, estimateThetaEAP, estimateThetaMLE } from './adaptive';
import { isRapidGuess } from './calibration-server';

/** Deterministic RNG (mulberry32) so simulations are reproducible. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal via Box–Muller. */
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());

describe('cut score', () => {
  it('134 ↔ θ = 1.7 under the θ·20 + 100 mapping', () => expect(CUT_THETA).toBeCloseTo(1.7, 12));
});

describe('Fisher information (3PL)', () => {
  it('peaks for items slightly easier than the student: b ≈ θ − 0.26 (a = 1.2, c = .25)', () => {
    const theta = 1;
    let best = { b: 0, info: 0 };
    for (let b = -2; b <= 3; b += 0.001) {
      const info = fisherInformation(theta, { b, c: 0.25 });
      if (info > best.info) best = { b, info };
    }
    const expected = theta - Math.log((1 + Math.sqrt(1 + 8 * 0.25)) / 2) / 1.2;
    expect(best.b).toBeCloseTo(expected, 2);
    expect(expected).toBeCloseTo(0.74, 2);
  });

  it('is ~0 for items far from the student, and never negative', () => {
    expect(fisherInformation(0, { b: 4 })).toBeLessThan(0.01);
    expect(fisherInformation(0, { b: -4 })).toBeLessThan(0.02);
    for (let b = -4; b <= 4; b += 0.5) expect(fisherInformation(0, { b })).toBeGreaterThanOrEqual(0);
  });

  it('uses the calibrated difficulty over the authored one', () => {
    expect(fisherInformation(2, { b: -2, b_calibrated: 2 })).toBeCloseTo(fisherInformation(2, { b: 2 }), 12);
  });

  it('SE = 1/√(test information), and more items → smaller SE', () => {
    const items = Array.from({ length: 10 }, () => ({ b: 0 }));
    expect(standardError(0, items)).toBeCloseTo(1 / Math.sqrt(testInformation(0, items)), 12);
    expect(standardError(0, items.concat(items))).toBeLessThan(standardError(0, items));
    expect(standardError(0, [])).toBe(Infinity);
  });
});

describe('routing target', () => {
  it('early sections always aim at the ability estimate', () => {
    expect(chooseRouteTarget({ nextSectionIndex: 3, theta: 1.6, se: 0.3 })).toEqual({ theta: 1.6, reason: 'ability' });
  });
  it('decision sections aim at the cut while it is within 2 SE of θ̂', () => {
    expect(chooseRouteTarget({ nextSectionIndex: 5, theta: 1.2, se: 0.3 })).toEqual({ theta: CUT_THETA, reason: 'cut_score' });
    expect(chooseRouteTarget({ nextSectionIndex: 7, theta: 2.2, se: 0.3 })).toEqual({ theta: CUT_THETA, reason: 'cut_score' });
  });
  it('…and back at θ̂ once the decision is already clear', () => {
    expect(chooseRouteTarget({ nextSectionIndex: 6, theta: 0.5, se: 0.3 })).toEqual({ theta: 0.5, reason: 'ability' });
    expect(chooseRouteTarget({ nextSectionIndex: 6, theta: 0.5, se: Infinity }).reason).toBe('cut_score'); // nothing known yet
  });
});

describe('exemption probability', () => {
  it('normal CDF matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 6);
  });
  it('is 50% exactly at the cut and moves with distance in SE units', () => {
    expect(exemptionProbability(CUT_THETA, 0.3)).toBeCloseTo(0.5, 7);
    expect(exemptionProbability(CUT_THETA + 0.3, 0.3)).toBeCloseTo(0.8413, 4);
    // The same θ̂ is far less certain with a bigger SE.
    expect(exemptionProbability(2.2, 0.2)).toBeGreaterThan(exemptionProbability(2.2, 0.6));
  });
  it('degenerates safely without an SE', () => {
    expect(exemptionProbability(2, Infinity)).toBe(1);
    expect(exemptionProbability(1, 0)).toBe(0);
  });
});

describe('Elo item calibration', () => {
  it('a wrong answer makes an item harder, a right one easier — by K·(p − outcome)', () => {
    const p = irtProbability(0, itemIrtParams({ b: 0 }));
    expect(eloStep(0, 0, 0, false)).toBeCloseTo(ELO_K0 * p, 12);
    expect(eloStep(0, 0, 0, true)).toBeCloseTo(-ELO_K0 * (1 - p), 12);
  });
  it('steps shrink as an item accumulates evidence', () => {
    const fresh = Math.abs(eloStep(0, 0, 0, false));
    const mature = Math.abs(eloStep(0, 200, 0, false));
    expect(mature).toBeLessThan(fresh / 5);
  });
  it('stays within ±4', () => {
    let b = 3.9;
    for (let i = 0; i < 100; i++) b = eloStep(b, 0, -3, false);
    expect(b).toBe(B_BOUND);
  });

  it('simulation: recovers a mis-authored item’s true difficulty from 400 students', () => {
    const r = rng(7);
    for (const { authored, truth } of [{ authored: 0, truth: 1.5 }, { authored: 2, truth: 0.5 }, { authored: -1, truth: -1 }]) {
      let b = authored;
      for (let n = 0; n < 400; n++) {
        const theta = gauss(r); // population ~ N(0, 1), the scale θ is anchored to
        const correct = r() < irtProbability(theta, itemIrtParams({ b: truth }));
        b = eloStep(b, n, theta, correct);
      }
      expect(Math.abs(b - truth), `authored ${authored} → truth ${truth}, got ${b.toFixed(2)}`).toBeLessThan(0.3);
    }
  });
});

describe('cut-score targeting (simulation)', () => {
  /** Runs one 23-item exam for a student at trueTheta and returns the final θ̂. */
  function exam(trueTheta: number, targetCut: boolean, r: () => number): number {
    const items: { b: number }[] = [];
    const outcomes: number[] = [];
    const sectionSizes = [4, 4, 5, 3, 3, 4];
    sectionSizes.forEach((size, s) => {
      const theta = items.length ? estimateThetaEAP(items.map(i => itemIrtParams(i)), outcomes) : 0;
      const se = standardError(theta, items);
      const target = targetCut ? chooseRouteTarget({ nextSectionIndex: s + 1, theta, se }).theta : theta;
      // The most informative item at the target (continuous bank).
      const b = target - Math.log((1 + Math.sqrt(3)) / 2) / 1.2;
      for (let k = 0; k < size; k++) {
        items.push({ b });
        outcomes.push(r() < irtProbability(trueTheta, itemIrtParams({ b })) ? 1 : 0);
      }
    });
    return estimateThetaMLE(0, items.map(i => itemIrtParams(i)), outcomes);
  }

  // Measured at 20,000 simulated students per policy (a one-off run, too
  // slow to keep in the suite): for students within ±12 points of 134,
  // cut targeting as configured classified 71.56% correctly vs 71.10% for
  // pure ability targeting; across a N(0.8, 0.8) population 88.58% vs
  // 88.91%, RMSE 0.483 vs 0.478. I.e. neutral: with 23 items, ability
  // targeting already concentrates information at θ̂ ≈ cut for borderline
  // students, and the ~0.45 SE the test length allows dominates. Targeting
  // the cut from section 3 would buy ~1.5 points near the cut at a large
  // precision cost for everyone else (RMSE 0.567). These tests pin the
  // property that holds — non-inferiority — rather than a gain the data
  // doesn't show.
  function compare(draw: (r: () => number) => number, n: number) {
    const cutArm = rng(99), abilityArm = rng(99); // common random numbers
    let rightCut = 0, rightAbility = 0, sqCut = 0, sqAbility = 0;
    for (let i = 0; i < n; i++) {
      const tCut = draw(cutArm), tAbility = draw(abilityArm);
      const eCut = exam(tCut, true, cutArm), eAbility = exam(tAbility, false, abilityArm);
      if ((eCut >= CUT_THETA) === (tCut >= CUT_THETA)) rightCut++;
      if ((eAbility >= CUT_THETA) === (tAbility >= CUT_THETA)) rightAbility++;
      sqCut += (eCut - tCut) ** 2;
      sqAbility += (eAbility - tAbility) ** 2;
    }
    return { accCut: rightCut / n, accAbility: rightAbility / n, rmseCut: Math.sqrt(sqCut / n), rmseAbility: Math.sqrt(sqAbility / n) };
  }

  it('is non-inferior for borderline students (within ±12 points of 134)', () => {
    const r = compare(rr => CUT_THETA + (rr() - 0.5) * 1.2, 3000);
    expect(r.accCut).toBeGreaterThan(r.accAbility - 0.02);
  });

  it('costs the rest of the population essentially no precision', () => {
    const r = compare(rr => 0.8 + 0.8 * gauss(rr), 3000);
    expect(r.rmseCut).toBeLessThan(r.rmseAbility + 0.03);
    expect(r.accCut).toBeGreaterThan(r.accAbility - 0.02);
  });
});

describe('rapid-guess filter', () => {
  it('drops answers faster than 5% of the type’s budget, keeps the rest and unknowns', () => {
    expect(isRapidGuess('sentence_completion', 2_000)).toBe(true);   // < 3 s
    expect(isRapidGuess('sentence_completion', 4_000)).toBe(false);
    expect(isRapidGuess('reading_comprehension', 8_000)).toBe(true); // < 9 s
    expect(isRapidGuess('restatement', null)).toBe(false);
  });
});
