import { readFileSync } from 'fs';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SECTION_CONFIGS } from '@/types/exam';

// Page chrome and the official-scores list (its own table, fetched on mount) aren't metrics under test.
vi.mock('@/components/BackNav', () => ({ BackNav: () => null }));
vi.mock('@/components/official-score/OfficialScoresSection', () => ({ OfficialScoresSection: () => null }));
import { computeStatsMetrics, type StatsRow } from '@/lib/stats-metrics';
import { StatsView } from './StatsView';

function exam(i: number, right: (s: number, q: number) => boolean, theta: number, score: number): StatsRow {
  return {
    score,
    completed_at: new Date(Date.UTC(2026, 7, 1 + i * 2)).toISOString(),
    theta_final: theta,
    theta_se: 0.55,
    p_exempt: null,
    section_results: SECTION_CONFIGS.map(cfg => {
      const questions = Array.from({ length: cfg.questionCount }, (_, q) => ({ id: `${i}-${cfg.index}-${q}`, correct_answer: 0, difficulty_level: 2 }));
      const answers = questions.map((_, q) => (right(cfg.index, q) ? 0 : 1));
      return { sectionIndex: cfg.index, type: cfg.type, questions, answers, correctCount: answers.filter(a => a === 0).length, totalCount: questions.length };
    }),
  };
}

// 13 exams: the first 3 get every sentence-completion item right, the rest one per section —
// so all-time and last-10 counts differ, and section 7 (all right) would inflate SC if counted.
const rows = Array.from({ length: 13 }, (_, i) =>
  exam(i, (s, q) => s === 7 || i < 3 || q === 0, -2.4 + i * 0.01, 50 + (i % 4)));

const render = (r: StatsRow[]) => renderToStaticMarkup(createElement(StatsView, { metrics: computeStatsMetrics(r), rows: r }));

/** Text of every element tagged data-metric="name". */
const metric = (html: string, name: string) =>
  [...html.matchAll(new RegExp(`data-metric="${name}"[^>]*>(.*?)</(?:p|dd|bdi)>`, 'g'))].map(m => m[1].replace(/<[^>]+>/g, ''));

describe('StatsView renders each metric once, from computeStatsMetrics', () => {
  const m = computeStatsMetrics(rows)!;
  const html = render(rows);

  it('the current level appears once, as the pooled range', () => {
    expect(metric(html, 'current-range')).toEqual([`${m.current!.lo}–${m.current!.hi}`]);
    expect(metric(html, 'points-to-target')).toHaveLength(1);
    expect(metric(html, 'points-to-target')[0]).toContain(String(m.current!.pointsToTarget));
  });

  it('exam count, best and last score each appear once, with the computed values', () => {
    expect(metric(html, 'exam-count')).toEqual(['13']);
    expect(metric(html, 'best-score')).toEqual([String(m.bestScore)]);
    expect(metric(html, 'last-score')).toEqual([String(m.lastScore)]);
  });

  it('no average is shown anywhere (replaced by the current level)', () => {
    expect(html).not.toContain('ממוצע');
  });

  it('the per-type counts shown are the last-10 scored-only ones, labelled as such', () => {
    const sc = m.recent.byType.sentence_completion;
    expect(sc.total).toBe(120);
    expect(metric(html, 'type-count')).toContain(`${sc.correct} נכונות מתוך ${sc.total}`);
    expect(metric(html, 'accuracy-window')[0]).toContain('10 המבחנים האחרונים');
    // Neither the all-time tally nor a section-7-inflated one (16/exam) is on screen by default.
    expect(html).not.toContain(`מתוך ${m.allTime.byType.sentence_completion.total}`);
    expect(html).not.toContain('מתוך 160');
    // One per-type list, not two.
    expect(html.match(/ביצועים לפי סוג שאלה/g)).toHaveLength(1);
    expect(html).not.toContain('ניתוח חולשות');
  });

  it('negative control: the rendered values track the input (the checks above are not vacuous)', () => {
    const fewer = rows.slice(0, 5);
    const other = render(fewer);
    expect(metric(other, 'exam-count')).toEqual(['5']);
    expect(metric(other, 'exam-count')).not.toEqual(metric(html, 'exam-count'));
    expect(metric(other, 'type-count')).not.toEqual(metric(html, 'type-count'));
  });

  it('the view does no aggregation of its own', () => {
    for (const f of ['src/app/stats/page.tsx', 'src/components/stats/StatsView.tsx', 'src/components/stats/StatsHero.tsx', 'src/components/stats/TypePerformanceCard.tsx']) {
      const src = readFileSync(path.resolve(__dirname, '../../..', f), 'utf8');
      expect(src, f).not.toMatch(/aggregateAccuracyByType|currentEstimate|\.reduce\(|Math\.max\(|slice\(-/);
    }
  });
});

describe('exams clicked through at random', () => {
  const timed = (row: StatsRow, seconds: number): StatsRow => ({
    ...row,
    section_results: (row.section_results as { answers: unknown[] }[]).map(sr => ({ ...sr, timings: sr.answers.map(() => seconds) })),
  });

  it('says how many were left out of the current level', () => {
    const r = [timed(exam(0, (_, q) => q < 3, 1.1, 122), 30), timed(exam(1, () => false, -2.7, 50), 1), timed(exam(2, () => false, -2.6, 50), 1)];
    expect(metric(render(r), 'excluded-low-effort')).toEqual(['לא כללנו ברמה שני מבחנים שנענו בשניות בודדות לשאלה, ברמת הצלחה של ניחוש אקראי.']);
  });

  it('says nothing when every exam measured the student', () => {
    expect(render(rows)).not.toContain('excluded-low-effort');
  });
});
