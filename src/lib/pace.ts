import { GUIDE_ID_BY_QUESTION_TYPE, TIME_BY_TYPE } from '@/data/strategies';

/**
 * The simulation's pace gauge. Compares questions answered so far with how
 * many the time budget (TIME_BUDGET[].plan, the same numbers the strategy
 * guide teaches) expects by now: nothing during the reading phase, then one
 * question per `perQuestionSec`.
 *
 * Counted in questions, not seconds, so the thresholds mean the same thing
 * in every section: at least one question ahead is "ahead"; more than half a
 * question behind is "behind". Answered-but-skipped-around still counts —
 * skipping a hard item is exactly the behavior the strategy teaches.
 */
export type PaceStatus = 'ahead' | 'on' | 'behind';

export const AHEAD_BY = 1;
export const BEHIND_BY = 0.5;
/** Stay quiet this far into a section unless something has been answered. */
export const QUIET_START_FRACTION = 0.25;

export interface PaceInput {
  /** Exam question type, e.g. 'sentence_completion'. */
  type: string;
  elapsedSec: number;
  durationSec: number;
  answered: number;
  total: number;
}

export function expectedAnswered(
  plan: { readingSec: number; perQuestionSec: number },
  elapsedSec: number,
  total: number,
): number {
  const working = elapsedSec - plan.readingSec;
  if (working <= 0) return 0;
  return Math.min(total, working / plan.perQuestionSec);
}

/** null = nothing to say yet (quiet start, or a section type without a plan). */
export function paceStatus({ type, elapsedSec, durationSec, answered, total }: PaceInput): PaceStatus | null {
  const guideId = GUIDE_ID_BY_QUESTION_TYPE[type];
  if (!guideId || total <= 0) return null;
  if (answered === 0 && elapsedSec < durationSec * QUIET_START_FRACTION) return null;
  if (answered >= total) return 'ahead';

  const lead = answered - expectedAnswered(TIME_BY_TYPE[guideId].plan, elapsedSec, total);
  if (lead >= AHEAD_BY) return 'ahead';
  if (lead < -BEHIND_BY) return 'behind';
  return 'on';
}
