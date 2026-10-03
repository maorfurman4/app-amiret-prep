/**
 * The one definition of "this section's time is over", shared by the
 * section submit (/api/exam/answer) and the in-progress answer save
 * (/api/exam/progress), so the two can never disagree about a deadline.
 *
 * A short grace absorbs network delay and clock skew. Past it, nothing the
 * client sends counts any more: the server keeps the answers it already
 * received in time (see /api/exam/progress), and those are what a late
 * section is scored on.
 */
export const LATE_GRACE_MS = 20_000;

export function isPastSectionDeadline(
  session: { is_practice?: boolean | null; current_section_expires_at?: string | null },
  now: number = Date.now(),
): boolean {
  if (session.is_practice || !session.current_section_expires_at) return false;
  return now > new Date(session.current_section_expires_at).getTime() + LATE_GRACE_MS;
}

/**
 * A section's answers as saved in time by /api/exam/progress, or null when
 * there are none (or they don't fit the section — never trusted blindly).
 */
export function savedSectionAnswers(
  answersBySection: unknown,
  sectionIndex: number,
  questionCount: number,
): (number | null)[] | null {
  if (!answersBySection || typeof answersBySection !== 'object') return null;
  const saved = (answersBySection as Record<string, unknown>)[String(sectionIndex)];
  if (!Array.isArray(saved) || saved.length !== questionCount) return null;
  const valid = saved.every(a => a === null || (Number.isInteger(a) && (a as number) >= 0 && (a as number) <= 3));
  return valid ? (saved as (number | null)[]) : null;
}
