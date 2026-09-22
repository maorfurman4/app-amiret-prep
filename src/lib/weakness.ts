import { SECTION_CONFIGS, type SectionResult, type DifficultyLevel } from '@/types/exam';
import { routeNextDifficulty } from '@/lib/adaptive';

// ── Types ────────────────────────────────────────────────────────────────

export interface TypeAccuracy { correct: number; total: number; }
export type AccuracyByType = Record<string, TypeAccuracy>;

export interface WeaknessResult {
  type: string;
  level: DifficultyLevel;
  accuracy: number; // 0-1, over the last up-to-10 exams
}

// ── Pure aggregation ─────────────────────────────────────────────────────
// Low-level building blocks with no opinion on which/how-many sessions to
// look at — callers (stats page, today-session) decide the window and
// compose these into whatever view they need.

/**
 * Tallies correct/total answers per question type across the given
 * sessions' section results. A section's type comes from SECTION_CONFIGS
 * (keyed by position) with a fallback to the row's own `type` field for
 * any section shape that doesn't map cleanly onto the standard exam
 * layout (e.g. practice-only section records).
 */
export function aggregateAccuracyByType(
  sessions: { section_results: unknown }[],
): AccuracyByType {
  const byType: AccuracyByType = {};
  for (const row of sessions) {
    for (const sr of ((row.section_results ?? []) as SectionResult[])) {
      const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
      const t = cfg?.type ?? sr.type;
      if (!t) continue;
      if (!byType[t]) byType[t] = { correct: 0, total: 0 };
      byType[t].correct += sr.correctCount ?? 0;
      byType[t].total += sr.totalCount ?? 0;
    }
  }
  return byType;
}

/**
 * Picks the type with the lowest accuracy from an already-aggregated
 * byType map. Types with zero attempts are ignored — there's nothing to
 * judge weakness from yet.
 */
export function findWeakestType(byType: AccuracyByType): { type: string; accuracy: number } | null {
  const entries = Object.entries(byType).filter(([, d]) => d.total > 0);
  if (entries.length === 0) return null;

  const worst = entries.reduce((worst, [type, d]) => {
    const pct = d.correct / d.total;
    const worstPct = worst.d.total > 0 ? worst.d.correct / worst.d.total : 1;
    return pct < worstPct ? { type, d } : worst;
  }, { type: entries[0][0], d: entries[0][1] });

  return { type: worst.type, accuracy: worst.d.correct / worst.d.total };
}

// ── Weakness policy ──────────────────────────────────────────────────────
// Opinionated defaults for "what should today's/next practice target":
// the last 10 exams' worst-performing type, at a difficulty derived from
// the student's most recent score.

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
  const weakest = findWeakestType(aggregateAccuracyByType(recent));
  if (!weakest) return null;

  const lastScore = sessions[sessions.length - 1]?.score ?? 100;
  const level = routeNextDifficulty((lastScore - 100) / 20);

  return { type: weakest.type, level, accuracy: weakest.accuracy };
}
