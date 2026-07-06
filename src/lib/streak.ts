const KEY = 'amiret_activity_days';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; }
  catch { return []; }
}

/** Record that the user practiced today (call on any answered question). */
export function recordActivity() {
  if (typeof window === 'undefined') return;
  const days = load();
  const t = today();
  if (!days.includes(t)) {
    days.push(t);
    localStorage.setItem(KEY, JSON.stringify(days.slice(-400)));
  }
}

/** Consecutive practice days ending today or yesterday (grace so the flame survives until tonight). */
export function getStreak(): number {
  if (typeof window === 'undefined') return 0;
  const days = new Set(load());
  const d = new Date();
  // If no activity today yet, allow the streak to be counted from yesterday
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
