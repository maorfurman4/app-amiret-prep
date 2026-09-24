import { describe, expect, it } from 'vitest';
import { BASELINE_A, BASELINE_C, estimateThetaEAP, posteriorEAP } from './adaptive';
import { DIAGNOSTIC, buildStartPlan, diagnosticState, typeSplit, type DiagnosticType, type ScoredItem } from './diagnostic-plan';

const item = (type: DiagnosticType, b: number, correct: boolean): ScoredItem => ({
  type, correct, params: { a: BASELINE_A, b, c: BASELINE_C },
});

/** Alternating SC/RS items targeted at `b`, answered per `pattern`. */
function session(pattern: boolean[], b = 0): ScoredItem[] {
  return pattern.map((correct, i) => item(i % 2 === 0 ? 'sentence_completion' : 'restatement', b, correct));
}

describe('posteriorEAP', () => {
  it('matches estimateThetaEAP and starts from the prior', () => {
    const items = [{ a: 1.2, b: 0.3, c: 0.25 }, { a: 1.2, b: -0.4, c: 0.25 }];
    expect(posteriorEAP(items, [1, 0]).theta).toBeCloseTo(estimateThetaEAP(items, [1, 0]), 10);
    const empty = posteriorEAP([], []);
    expect(empty.theta).toBeCloseTo(0, 6);
    expect(empty.sd).toBeGreaterThan(0.95);
  });

  it('narrows as answers accumulate', () => {
    const few = posteriorEAP(session([true, false]).map(i => i.params), [1, 0]);
    const many = posteriorEAP(session([true, false, true, false, true, false, true, false]).map(i => i.params), [1, 0, 1, 0, 1, 0, 1, 0]);
    expect(many.sd).toBeLessThan(few.sd);
  });
});

describe('diagnosticState', () => {
  it('never stops before the minimum, even if certain', () => {
    const s = diagnosticState(session([true, false, true, false, true]));
    expect(s.done).toBe(false);
    expect(s.progress).toBeLessThan(1);
  });

  it('always stops at the maximum', () => {
    const s = diagnosticState(session(Array(DIAGNOSTIC.maxItems).fill(true), 2.5));
    expect(s.done).toBe(true);
    expect(s.progress).toBe(1);
  });

  it('stops between min and max once the posterior SD hits the target', () => {
    const pattern = [true, false, true, false, true, false, true, false, true, false];
    const stopAt = pattern.findIndex((_, i) => diagnosticState(session(pattern.slice(0, i + 1))).done) + 1;
    expect(stopAt).toBeGreaterThanOrEqual(DIAGNOSTIC.minItems);
    expect(stopAt).toBeLessThanOrEqual(DIAGNOSTIC.maxItems);
    expect(diagnosticState(session(pattern.slice(0, stopAt))).sd).toBeLessThanOrEqual(DIAGNOSTIC.targetSd + 1e-9);
  });

  it('alternates types, starting with sentence completion', () => {
    expect(diagnosticState([]).nextType).toBe('sentence_completion');
    expect(diagnosticState([item('sentence_completion', 0, true)]).nextType).toBe('restatement');
    expect(diagnosticState(session([true, true])).nextType).toBe('sentence_completion');
  });
});

describe('typeSplit', () => {
  it('treats a modest gap as noise', () => {
    // SC 3/4, RS 2/4 at the same difficulty: a difference, but not a real one.
    const items = [
      item('sentence_completion', 0, true), item('restatement', 0, true),
      item('sentence_completion', 0, true), item('restatement', 0, false),
      item('sentence_completion', 0, true), item('restatement', 0, true),
      item('sentence_completion', 0, false), item('restatement', 0, false),
    ];
    expect(typeSplit(items).significant).toBe(false);
  });

  it('splits only on a stark contrast', () => {
    const items = [
      ...Array.from({ length: 5 }, () => item('sentence_completion', 0.5, true)),
      ...Array.from({ length: 5 }, () => item('restatement', -0.5, false)),
    ];
    expect(typeSplit(items).significant).toBe(true);
  });
});

describe('buildStartPlan', () => {
  it('prescribes one unified level and starts with sentence completion when there is no real split', () => {
    const plan = buildStartPlan(session([true, false, true, false, true, false, true, false]));
    expect(plan.split).toBe(false);
    expect(plan.primary.type).toBe('sentence_completion');
    expect(plan.primary.level).toBe(plan.level);
    expect(plan.secondary.level).toBe(plan.level);
    expect(plan.primary.href).toBe(`/practice?type=sentence_completion&difficulty=${plan.level}&start=1`);
    expect(plan.levelRange[0]).toBeLessThanOrEqual(plan.level);
    expect(plan.levelRange[1]).toBeGreaterThanOrEqual(plan.level);
  });

  it('starts with the weaker type, at its own level, when the split is real', () => {
    const plan = buildStartPlan([
      ...Array.from({ length: 5 }, () => item('sentence_completion', 0.5, true)),
      ...Array.from({ length: 5 }, () => item('restatement', -0.5, false)),
    ]);
    expect(plan.split).toBe(true);
    expect(plan.primary.type).toBe('restatement');
    expect(plan.primary.level).toBeLessThan(plan.secondary.level);
  });

  it('suggests vocabulary work only in the lower band', () => {
    expect(buildStartPlan(session(Array(8).fill(false), -1)).suggestVocabulary).toBe(true);
    expect(buildStartPlan(session(Array(8).fill(true), 1)).suggestVocabulary).toBe(false);
  });
});
