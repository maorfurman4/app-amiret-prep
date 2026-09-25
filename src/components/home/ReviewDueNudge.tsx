/**
 * Single-line nudge inside the "Today" card. The copy states the real FSRS
 * mechanic (src/lib/fsrs.ts): an item comes due when its predicted recall
 * has faded to the target, which is exactly when a successful retrieval
 * strengthens the memory most — and it does keep fading if left.
 */
export function ReviewDueNudge({ dueCount }: { dueCount: number }) {
  if (dueCount < 1) return null;

  return (
    <p className="text-xs text-exam-ink-soft text-center">
      <span className="font-bold text-exam-wrong tabular-nums">{dueCount}</span>
      {' '}
      {dueCount === 1 ? 'פריט ממתין לחזרה' : 'פריטים ממתינים לחזרה'}
      {'. עכשיו, כשהזיכרון מתחיל לדעוך, חזרה מחזקת אותו הכי הרבה'}
    </p>
  );
}
