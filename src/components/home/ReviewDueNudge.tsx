import { DAILY_REVIEW_TARGET, reviewsLeftToday, type Rings } from '@/lib/rings';

/**
 * One calm line under the "Today" CTA, only when the due backlog is larger
 * than today's review goal (src/lib/rings.ts reviewTarget): it says the rest
 * waits, so the student never reads the raw backlog as today's homework.
 */
export function ReviewDueNudge({ retention }: { retention: Rings['retention'] }) {
  const left = reviewsLeftToday(retention);
  const waiting = retention.due - left;
  if (waiting < 1) return null;

  return (
    <p className="mt-2.5 px-1.5 text-xs text-exam-ink-soft text-center">
      {left > 0
        ? `שאר החזרות יחכו לימים הבאים, ${DAILY_REVIEW_TARGET} בכל יום.`
        : 'סיימת את החזרות של היום. את השאר נמשיך מחר.'}
    </p>
  );
}
