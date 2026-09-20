/**
 * Anki-style interval-doubling algorithm, shared by every spaced-repetition
 * surface in the app: the wrong-answer review queue and vocabulary's
 * known-word tracking both use the same "double on success, reset to 1 on
 * failure, cap the maximum gap" shape — only the cap and what "success"
 * means differ per surface.
 */
export function nextInterval(currentDays: number, capDays: number): number {
  const doubled = Math.max(currentDays, 1) * 2;
  return Math.min(doubled, capDays);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isDue(nextReviewAt: string | Date, now: Date = new Date()): boolean {
  return new Date(nextReviewAt).getTime() <= now.getTime();
}
