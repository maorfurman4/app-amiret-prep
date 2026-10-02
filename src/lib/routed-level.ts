import { routeNextDifficulty } from '@/lib/adaptive';
import type { DifficultyLevel } from '@/types/exam';

/** Every exam's first section aims here (the prior mean): a medium section. */
export const EXAM_START_THETA = 0;

export interface ThetaHistoryEntry {
  after_section: number;
  theta?: number;
  target_theta?: number;
  /** Why the next section aimed where it did (src/lib/calibration.ts chooseRouteTarget). */
  target_reason?: string;
}

/**
 * The level the algorithm aimed each section at — what the student was
 * routed to — rather than the authored label of the section's first
 * question. Items are chosen a little below the target (the information
 * optimum) and passages come in coarse difficulty clusters, so near a level
 * boundary the first question's label can read one level lower than where
 * the student actually was.
 *
 * Section 1 aims at EXAM_START_THETA; section n at the target stored after
 * section n−1. Exams from before targets were stored have none, so this
 * returns null and the caller falls back to the question's label.
 */
export function routedLevel(sectionIndex: number, history: ThetaHistoryEntry[] | null | undefined): DifficultyLevel | null {
  const entries = history ?? [];
  if (!entries.some(h => typeof h.target_theta === 'number')) return null;
  if (sectionIndex === 1) return routeNextDifficulty(EXAM_START_THETA);
  const before = entries.find(h => h.after_section === sectionIndex - 1);
  return typeof before?.target_theta === 'number' ? routeNextDifficulty(before.target_theta) : null;
}

export interface SectionLevelTag {
  level: DifficultyLevel;
  /** The section was aimed at the exemption cut, not at the student's ability. */
  cutTargeted: boolean;
}

/**
 * The "level X/5" a results page shows for a section. Normally that is the
 * routed level — where the student's answers so far had placed them. In
 * the decision sections, though, a student near 134 is aimed at the cut
 * score itself (chooseRouteTarget's 'cut_score'), so the routed level says
 * where the cut is, not where the student is: a 112-level student would
 * read "level 5". For those sections the tag is the level of the questions
 * actually served, marked as cut-targeted. Exams from before targets were
 * stored fall back to the first question's authored label.
 */
export function sectionLevelTag(
  sectionIndex: number,
  history: ThetaHistoryEntry[] | null | undefined,
  questions: { difficulty_level?: number | null }[] | null | undefined,
): SectionLevelTag | null {
  const before = sectionIndex > 1 ? (history ?? []).find(h => h.after_section === sectionIndex - 1) : undefined;
  const cutTargeted = before?.target_reason === 'cut_score';
  if (cutTargeted) {
    const levels = (questions ?? []).map(q => q?.difficulty_level).filter((l): l is number => typeof l === 'number');
    if (levels.length > 0) {
      const served = Math.round(levels.reduce((a, l) => a + l, 0) / levels.length);
      return { level: Math.min(5, Math.max(1, served)) as DifficultyLevel, cutTargeted };
    }
  }
  const level = routedLevel(sectionIndex, history) ?? (questions?.[0]?.difficulty_level as DifficultyLevel | undefined) ?? null;
  return level ? { level, cutTargeted } : null;
}
