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

/** The app timezone's UTC offset at `at`, in ms (positive east of UTC). */
function tzOffsetMs(at: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant local midnight began on the given local date (DST-correct). */
export function localMidnight(dateStr: string): Date {
  const utcMidnight = Date.parse(`${dateStr}T00:00:00Z`);
  // Offset at that wall-clock moment; re-check once in case the guess
  // straddled a DST switch.
  let instant = utcMidnight - tzOffsetMs(new Date(utcMidnight));
  instant = utcMidnight - tzOffsetMs(new Date(instant));
  return new Date(instant);
}

/** Start of "today" in the app timezone, as an instant. */
export function localDayStart(now: Date = new Date()): Date {
  return localMidnight(new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(now));
}

/** Start of the current local week — Sunday, the Israeli week start. */
export function localWeekStart(now: Date = new Date()): Date {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return localMidnight(addLocalDays(today, -dow));
}

/** Whole local calendar days from `fromDateStr` to `toDateStr` (YYYY-MM-DD). */
export function localDaysBetween(fromDateStr: string, toDateStr: string): number {
  return Math.round((Date.parse(`${toDateStr}T00:00:00Z`) - Date.parse(`${fromDateStr}T00:00:00Z`)) / 86_400_000);
}
