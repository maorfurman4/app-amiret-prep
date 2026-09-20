import { SECTION_CONFIGS, type SectionResult, type DifficultyLevel } from '@/types/exam';
import { routeNextDifficulty } from '@/lib/adaptive';

export interface WeaknessResult {
  type: string;
  level: DifficultyLevel;
  accuracy: number; // 0-1, over the last up-to-10 exams
}

/**
 * Finds the question type the student is currently weakest at, from their
 * last (up to) 10 completed exam sessions — the same window and "worst
 * accuracy wins" logic already shown on /stats, kept as a small shared
 * function so the stats page's one-tap CTA and the "today's session"
 * auto-pick agree on what "your weakness" means.
 */
export function computeWeakestType(
  sessions: { score: number; section_results: unknown }[],
): WeaknessResult | null {
  if (sessions.length === 0) return null;

  const recent = sessions.slice(-10);
  const byType: Record<string, { correct: number; total: number }> = {};
  for (const row of recent) {
    for (const sr of ((row.section_results ?? []) as SectionResult[])) {
      const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
      const t = cfg?.type ?? sr.type;
      if (!t) continue;
      if (!byType[t]) byType[t] = { correct: 0, total: 0 };
      byType[t].correct += sr.correctCount ?? 0;
      byType[t].total += sr.totalCount ?? 0;
    }
  }

  const entries = Object.entries(byType).filter(([, d]) => d.total > 0);
  if (entries.length === 0) return null;

  const worst = entries.reduce((worst, [type, d]) => {
    const pct = d.correct / d.total;
    const worstPct = worst.d.total > 0 ? worst.d.correct / worst.d.total : 1;
    return pct < worstPct ? { type, d } : worst;
  }, { type: entries[0][0], d: entries[0][1] });

  const lastScore = sessions[sessions.length - 1]?.score ?? 100;
  const level = routeNextDifficulty((lastScore - 100) / 20);

  return { type: worst.type, level, accuracy: worst.d.correct / worst.d.total };
}
