import { routeNextDifficulty } from '@/lib/adaptive';
import type { DifficultyLevel } from '@/types/exam';

/** Every exam's first section aims here (the prior mean): a medium section. */
export const EXAM_START_THETA = 0;

export interface ThetaHistoryEntry {
  after_section: number;
  theta?: number;
  target_theta?: number;
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
