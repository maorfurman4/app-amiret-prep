'use client';

import { useDashboardSummary } from '@/lib/dashboard-context';

const DEFAULT_TAGLINE = 'הכנה ממוקדת לאמירנ"ט, בדרך לפטור';

/**
 * Replaces the static tagline with a personalized one once we know the
 * user's last real-exam score. No score yet (new user / not loaded /
 * network error) → identical default tagline, same markup/classes.
 */
export function HeroTagline() {
  const { data } = useDashboardSummary();
  const score = data?.lastScore;

  let text = DEFAULT_TAGLINE;
  if (score != null) {
    text = score >= 134
      ? `האומדן הפנימי האחרון שלך: ${score}, מעל 134`
      : `הציון האחרון שלך: ${score} · עוד ${134 - score} נק׳ ל-134+`;
  }

  return <p className="text-exam-ink-soft">{text}</p>;
}
