'use client';

/**
 * Dev-only /stats with generated exams, for design review: the real
 * StatsView fed through computeStatsMetrics, with no network reads or
 * writes. ?state=full (default) | reached | two | one | empty.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SECTION_CONFIGS } from '@/types/exam';
import { computeStatsMetrics, type StatsRow } from '@/lib/stats-metrics';
import { StatsView } from '@/components/stats/StatsView';

/** Share answered right per type, growing from the first exam to the last. */
const RATE: Record<string, [number, number]> = {
  sentence_completion: [0.7, 0.9],
  reading_comprehension: [0.58, 0.74],
  restatement: [0.42, 0.58],
};
const DAYS = [0, 3, 6, 10, 13, 17, 20, 24, 28, 31, 36, 40];

function exam(i: number, n: number, score: number): StatsRow {
  const t = n > 1 ? i / (n - 1) : 1;
  return {
    score,
    completed_at: new Date(Date.UTC(2026, 8, 8 + DAYS[i % DAYS.length], 15)).toISOString(),
    section_results: SECTION_CONFIGS.map(cfg => {
      const [a, b] = RATE[cfg.type];
      const rate = a + (b - a) * t;
      const questions = Array.from({ length: cfg.questionCount }, (_, q) => ({
        id: `${i}-${cfg.index}-${q}`, correct_answer: 0, difficulty_level: 1 + ((q + cfg.index + i) % 5),
      }));
      // Deterministic spread: question q is right when its slot falls under the rate.
      const answers = questions.map((_, q) => (((q * 7 + cfg.index * 3 + i * 5) % 10) / 10 < rate ? 0 : 1));
      return {
        sectionIndex: cfg.index, type: cfg.type, questions, answers, timings: questions.map(() => 45),
        correctCount: answers.filter(x => x === 0).length, totalCount: questions.length,
      };
    }),
  };
}

const SCORES: Record<string, number[]> = {
  full: [96, 101, 99, 105, 108, 104, 112, 110, 115, 124, 113, 118],
  reached: [104, 112, 118, 121, 127, 131, 136, 138],
  two: [92, 99],
  one: [97],
  empty: [],
};

function Preview() {
  const state = useSearchParams().get('state') ?? 'full';
  const scores = SCORES[state] ?? SCORES.full;
  const rows = scores.map((s, i) => exam(i, scores.length, s));
  return <StatsView metrics={computeStatsMetrics(rows)} rows={rows} />;
}

export function StatsPreview() {
  return <Suspense><Preview /></Suspense>;
}
