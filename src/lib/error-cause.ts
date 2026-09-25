import { GUIDE_ID_BY_QUESTION_TYPE, TIME_BY_TYPE } from '@/data/strategies';

/** Why a wrong answer went wrong, as the student reports it (responses.error_cause). */
export const ERROR_CAUSES = ['vocab', 'logic', 'time', 'careless'] as const;
export type ErrorCause = (typeof ERROR_CAUSES)[number];

export const ERROR_CAUSE_LABEL: Record<ErrorCause, string> = {
  vocab: 'לא הכרתי מילה',
  logic: 'טעיתי בהיגיון',
  time: 'לחץ זמן',
  careless: 'ידעתי, פספסתי',
};

/** A wrong answer this fast was more likely a slip than a real attempt. */
export const CARELESS_MAX_MS = 8_000;

/**
 * A soft suggestion from how long the item took — shown as a dashed outline,
 * never pre-selected. Over the type's stuck cap suggests time pressure (for
 * reading comprehension the passage's reading time is added, since the first
 * question's dwell includes it); under CARELESS_MAX_MS suggests a slip.
 */
export function suggestCause(type: string, latencyMs: number | null | undefined): ErrorCause | null {
  if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs <= 0) return null;
  if (latencyMs < CARELESS_MAX_MS) return 'careless';
  const guideId = GUIDE_ID_BY_QUESTION_TYPE[type];
  if (!guideId) return null;
  const { readingSec, stuckCapSec } = TIME_BY_TYPE[guideId].plan;
  return latencyMs > (readingSec + stuckCapSec) * 1000 ? 'time' : null;
}

/** Where a tag is written: a browser-logged row, or an exam row. */
export type TagTarget =
  | { clientRef: string }
  | { sessionId: string; itemId: string };
