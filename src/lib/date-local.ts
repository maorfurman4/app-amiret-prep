/**
 * Single source of truth for "what day/time is it" in the app's target
 * timezone (Israel) — used by both server code (streak-server.ts) and
 * client components (StreakBadge/StreakCelebration) so the definition of
 * "today" can never drift between the two.
 */
export const APP_TZ = 'Asia/Jerusalem';

export function todayLocalStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(new Date());
}

export function addLocalDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** True after ~18:00 in the app's timezone — used for the streak-at-risk UI. */
export function isEveningLocal(): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: APP_TZ, hour: 'numeric', hour12: false }).format(new Date()));
  return hour >= 18;
}
