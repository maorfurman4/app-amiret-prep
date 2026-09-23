/**
 * Single-line, honest loss-aversion nudge inside the "Today" card. Phase A:
 * copy describes the real spaced-repetition mechanic (a correct review
 * doubles the interval, a wrong one resets it) — intervals do not currently
 * decay from neglect, so the copy never claims otherwise. See the
 * architectural plan's Pillar 3 for the Phase B (real neglect-decay cron)
 * that would make a stronger claim honest later.
 */
export function ReviewDueNudge({ dueCount }: { dueCount: number }) {
  if (dueCount < 1) return null;

  return (
    <p className="text-xs text-exam-ink-soft text-center">
      <span className="font-bold text-exam-wrong tabular-nums">{dueCount}</span>
      {' '}
      {dueCount === 1 ? 'פריט ממתין לחזרה' : 'פריטים ממתינים לחזרה'}
      {' — תשובה נכונה תכפיל את המרווח הבא, תשובה שגויה תאפס אותו'}
    </p>
  );
}
