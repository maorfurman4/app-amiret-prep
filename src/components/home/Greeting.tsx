'use client';

import { useDashboardSummary } from '@/lib/dashboard-context';
import { localHour } from '@/lib/date-local';
import { EXEMPTION_SCORE } from '@/lib/calibration';
import { heCount } from '@/lib/hebrew-count';

const WELCOME = 'ברוך הבא ל-134+';

export function greetingFor(hour: number, name: string | null): string {
  if (!name) return WELCOME;
  const part = hour >= 5 && hour < 12 ? 'בוקר טוב' : hour >= 12 && hour < 17 ? 'צהריים טובים' : 'ערב טוב';
  return `${part}, ${name}`;
}

/** What follows "הציון האחרון שלך <score>" in the line under the greeting. */
export function scoreLineRest(score: number): string {
  const gap = EXEMPTION_SCORE - score;
  if (gap <= 0) return ', מעל רף הפטור. שמור על הקצב.';
  if (gap === 1) return ', חסרה נקודה אחת לפטור, אתה בדרך.';
  return `. עוד ${heCount(gap, 'point')} לפטור, אתה בדרך.`;
}

/**
 * The line under the logo: a time-of-day greeting by first name, or a
 * welcome for a guest. Rendered only once the summary has settled (the
 * hour is the device's, so the server can't render it), in a slot that
 * holds its height meanwhile so nothing below jumps. Under it, one quiet
 * line with the last exam score, or a nudge to take a first exam; nothing
 * if the summary failed, since then we can't tell which is true.
 */
export function Greeting() {
  const { data, loading } = useDashboardSummary();
  const score = data?.lastScore ?? null;
  return (
    <>
      <p className="mt-3.5 min-h-[1.3em] text-[22px] leading-[1.3] font-extrabold tracking-[-0.02em] text-exam-ink">
        {!loading && <span className="animate-fade-up">{greetingFor(localHour(), data?.displayName ?? null)}</span>}
      </p>
      <p className="mt-1 min-h-[1.45em] text-[13.5px] leading-[1.45] text-exam-ink-soft">
        {data && (
          <span className="animate-fade-up">
            {score == null
              ? 'עשה מבחן ראשון כדי לראות איפה אתה עומד.'
              : <>הציון האחרון שלך <b className="font-bold text-exam-ink tabular-nums">{score}</b>{scoreLineRest(score)}</>}
          </span>
        )}
      </p>
    </>
  );
}
