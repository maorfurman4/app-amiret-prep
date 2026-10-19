/**
 * When the timed vocab quiz moves on after an answer (or a timeout), and
 * whether it should at all. It used to be a bare setTimeout fired from the
 * answer handler, never cancelled: switching to flashcards within the pause,
 * or leaving the page, still advanced the run behind the student's back —
 * and on the last word still saved a history entry.
 *
 * The page schedules the advance from an effect keyed on these inputs, so
 * any change (mode switch, unmount, run finished) cancels it, and coming
 * back to the timed tab schedules it again.
 */
export const ADVANCE_AFTER_ANSWER_MS = 1200;
export const ADVANCE_AFTER_TIMEOUT_MS = 1000;

/** `selected` is the picked option's index, -1 for a timeout, null while unanswered. */
export function timedAdvanceDelay({ mode, selected, done }: { mode: string; selected: number | null; done: boolean }): number | null {
  if (mode !== 'timed' || done || selected === null) return null;
  return selected === -1 ? ADVANCE_AFTER_TIMEOUT_MS : ADVANCE_AFTER_ANSWER_MS;
}
