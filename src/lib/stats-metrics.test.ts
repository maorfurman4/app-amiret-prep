import { describe, expect, it } from 'vitest';
import { SECTION_CONFIGS } from '@/types/exam';
import { computeWeakestType } from '@/lib/weakness';
import {
  aggregateAccuracyByDifficulty, computeStatsMetrics, windowLabel, type StatsRow,
} from './stats-metrics';

// ── Fixture: a full 7-section exam (section 7 = the unscored experimental one) ──

type Outcome = (sectionIndex: number, q: number) => boolean;

function exam(i: number, outcome: Outcome, opts: { level?: (s: number, q: number) => number; score?: number } = {}): StatsRow {
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
  const rows = Array.from({ length: 13 }, (_, i) => exam(i, (_s, q) => (i < 3 ? true : q === 0)));

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

describe('headline score and readiness rest on actual scores', () => {
  const scored = (scores: number[]) => scores.map((score, i) => exam(i, () => false, { score }));

  it('the headline is the last exam\'s score, with the gap to 134 from it', () => {
    const m = computeStatsMetrics(scored([50, 50, 53]))!;
    expect(m.measured).toEqual({ score: 53, isLatestExam: true, pointsToTarget: 81 });
  });

  it('readiness quotes the lowest of the last 3 scores, and the verdict follows it', () => {
    const m = computeStatsMetrics(scored([140, 150, 118, 138, 136]))!;
    expect(m.readiness.reasons.some(r => r.text.includes('הציון הנמוך מבין 3 המבחנים האחרונים: 118') && r.text.includes('חסרות 16'))).toBe(true);
    expect(m.readiness.verdict).toBe('not_yet');
  });

  it('one good day isn\'t "ready": the lowest recent score decides', () => {
    const almost = computeStatsMetrics(scored([125, 122, 145]))!;
    expect(almost.readiness.verdict).toBe('almost');
  });

  it('no reason mentions a modelled level', () => {
    const m = computeStatsMetrics(scored([90, 100, 110]))!;
    expect(m.readiness.reasons.some(r => r.text.includes('משוערת'))).toBe(false);
  });
});

describe('exams clicked through at random', () => {
  // Those same three exams really were answered in about a second per
  // question (median 0.7–0.9 s), at chance accuracy.
  const withSeconds = (row: StatsRow, seconds: number): StatsRow => ({
    ...row,
    section_results: (row.section_results as { answers: unknown[] }[]).map(sr => ({ ...sr, timings: sr.answers.map(() => seconds) })),
  });
  const clicked = [0, 1, 2].map(i => withSeconds(exam(i, () => false, { score: 50 }), 1));
  const measured = [124, 125].map((score, i) => withSeconds(exam(10 + i, (_s, q) => q < 3, { score }), 30));

  it('are left out of the headline score and readiness, but still counted as exams', () => {
    const m = computeStatsMetrics([...measured, ...clicked])!;
    expect(m.examCount).toBe(5);
    expect(m.lastScore).toBe(50);
    expect(m.excludedLowEffort).toBe(3);
    expect(m.measured).toEqual({ score: 125, isLatestExam: false, pointsToTarget: 9 });
    expect(m.readiness.reasons.some(r => r.text.includes('2 המבחנים האחרונים'))).toBe(true);
  });

  it('leave no headline score when nothing measured the student', () => {
    const m = computeStatsMetrics(clicked)!;
    expect(m.measured).toBeNull();
    expect(m.excludedLowEffort).toBe(3);
  });

  it('a fast exam that is right is not excluded', () => {
    const fastAndRight = withSeconds(exam(20, () => true, { score: 148 }), 1);
    expect(computeStatsMetrics([fastAndRight])!.excludedLowEffort).toBe(0);
  });
});
