import { describe, expect, it } from 'vitest';
import { SECTION_CONFIGS } from '@/types/exam';
import { computeWeakestType } from '@/lib/weakness';
import {
  aggregateAccuracyByDifficulty, computeCurrentLevel, computeStatsMetrics, windowLabel, type StatsRow,
} from './stats-metrics';

// ── Fixture: a full 7-section exam (section 7 = the unscored experimental one) ──

type Outcome = (sectionIndex: number, q: number) => boolean;

function exam(i: number, outcome: Outcome, opts: { level?: (s: number, q: number) => number; score?: number; theta?: number; se?: number } = {}): StatsRow {
  const section_results = SECTION_CONFIGS.map(cfg => {
    const questions = Array.from({ length: cfg.questionCount }, (_, q) => ({
      id: `e${i}-s${cfg.index}-q${q}`,
      correct_answer: 0,
      difficulty_level: opts.level?.(cfg.index, q) ?? 3,
    }));
    const answers = questions.map((_, q) => (outcome(cfg.index, q) ? 0 : 1));
    return {
      sectionIndex: cfg.index,
      type: cfg.type,
      questions,
      answers,
      correctCount: answers.filter(a => a === 0).length,
      totalCount: questions.length,
    };
  });
  return {
    score: opts.score ?? 60,
    completed_at: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
    section_results,
    theta_final: opts.theta ?? -2,
    theta_se: opts.se ?? 0.5,
    p_exempt: null,
  };
}

const onlyExperimentalRight: Outcome = s => s === 7;

describe('accuracy counts scored questions only', () => {
  it('leaves the experimental section out of the per-type tally', () => {
    const m = computeStatsMetrics([exam(0, onlyExperimentalRight)])!;
    // 12 scored sentence-completion items (sections 1, 2, 6), none right.
    expect(m.allTime.byType.sentence_completion).toEqual({ correct: 0, total: 12 });
  });

  it('negative control: the fixture really would differ if section 7 were counted', () => {
    const withSeven = exam(0, onlyExperimentalRight).section_results as { type: string; correctCount: number; totalCount: number }[];
    const naive = withSeven.filter(s => s.type === 'sentence_completion')
      .reduce((a, s) => ({ correct: a.correct + s.correctCount, total: a.total + s.totalCount }), { correct: 0, total: 0 });
    expect(naive).toEqual({ correct: 4, total: 16 });
    expect(computeStatsMetrics([exam(0, onlyExperimentalRight)])!.allTime.byType.sentence_completion).not.toEqual(naive);
  });

  it('also keeps it out of the difficulty breakdown', () => {
    const d = aggregateAccuracyByDifficulty([exam(0, onlyExperimentalRight)]);
    expect(d.medium).toEqual({ correct: 0, total: 23 }); // 12 SC + 5 RC + 6 RE
  });
});

describe('difficulty is per question, not per section', () => {
  it('files each question under its own level', () => {
    // Section 1 mixes levels [1, 1, 5, 5]; only the level-5 items are right.
    const row = exam(0, (s, q) => s === 1 && q >= 2, { level: (s, q) => (s === 1 ? [1, 1, 5, 5][q] : 3) });
    const d = aggregateAccuracyByDifficulty([row]);
    expect(d.hard).toEqual({ correct: 2, total: 2 });
    expect(d.easy).toEqual({ correct: 0, total: 2 });
    // The old questions[0] shortcut would have reported easy 2/4 and no hard at all.
  });
});

describe('windows', () => {
  const rows = Array.from({ length: 13 }, (_, i) => exam(i, (s, q) => (i < 3 ? true : q === 0)));

  it('recent = last 10, allTime = all, and each carries a distinct label', () => {
    const m = computeStatsMetrics(rows)!;
    expect(m.recent.exams).toBe(10);
    expect(m.allTime.exams).toBe(13);
    expect(windowLabel(m.recent)).toBe('10 המבחנים האחרונים');
    expect(windowLabel(m.allTime)).toBe('כל 13 המבחנים');
    expect(m.recent.byType.sentence_completion.total).toBe(120);
    expect(m.allTime.byType.sentence_completion.total).toBe(156);
  });

  it('with 10 or fewer exams the two windows are the same and say so', () => {
    const m = computeStatsMetrics(rows.slice(0, 4))!;
    expect(m.recent.isAllTime).toBe(true);
    expect(windowLabel(m.recent)).toBe('כל 4 המבחנים');
  });

  it('the practice pick and the flagged weakest type come from the recent window — the same pick as today\'s session', () => {
    const m = computeStatsMetrics(rows)!;
    expect(m.weakest).toEqual(computeWeakestType(rows));
    const w = m.recent.byType[m.weakest!.type];
    expect(m.weakest!.accuracy).toBeCloseTo(w.correct / w.total);
  });

  it('readiness judges type accuracy on the same last-10 window (no separate last-3 window)', () => {
    // Last 3 exams perfect, the 7 before them near-zero: a last-3 window would call every type ≥70%.
    const mixed = Array.from({ length: 10 }, (_, i) => exam(i, () => i >= 7));
    const r = computeStatsMetrics(mixed)!.readiness.reasons.find(x => x.text.includes('70%'))!;
    expect(r.ok).toBe(false);
    expect(r.text).toContain('(כל 10 המבחנים)');
  });
});

describe('current level', () => {
  // The real pooled inputs behind the reported "50–56" (last 3 exams: θ̂ and SE, read-only query 2026-09-30).
  const real = [
    { theta: -2.718, se: 0.584 },
    { theta: -2.770, se: 0.607 },
    { theta: -2.375, se: 0.551 },
  ].map((m, i) => exam(i, () => false, { theta: m.theta, se: m.se, score: [50, 50, 53][i] }));

  it('pools the last 3 into one range, flags the floor, and derives the one points-to-134 from it', () => {
    const c = computeCurrentLevel(real)!;
    expect([c.lo, c.hi]).toEqual([50, 56]);
    expect(c.loAtFloor).toBe(true);
    expect(c.pointsToTarget).toBe(78);
    expect(c.used).toBe(3);
  });

  it('readiness quotes that same range and gap', () => {
    const m = computeStatsMetrics(real)!;
    expect(m.readiness.reasons.some(r => r.text.includes('50–56') && r.text.includes('לפחות 78'))).toBe(true);
    expect(m.readiness.verdict).toBe('not_yet');
  });
});
