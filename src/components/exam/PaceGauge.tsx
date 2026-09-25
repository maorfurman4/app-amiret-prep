'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { useCountdown } from '@/lib/use-countdown';
import { paceStatus, type PaceStatus } from '@/lib/pace';
import { setPaceHint, usePaceHint } from '@/lib/pace-preference';

/** A new status must hold this long before it is shown — no flicker. */
export const PACE_STABLE_MS = 10_000;

const LOOK: Record<PaceStatus, { label: string; dot: string; hint: string }> = {
  on: {
    label: 'בקצב',
    dot: 'bg-exam-sage',
    hint: 'אתה בדיוק בתקציב הזמן של הפרק. המשך כך.',
  },
  ahead: {
    label: 'יש לך מרווח',
    dot: 'bg-exam-accent',
    hint: 'אתה מקדים את התקציב. את הזמן העודף אפשר להשקיע בשאלות שסימנת כי לא היית בטוח.',
  },
  behind: {
    label: 'כדאי להתקדם',
    dot: 'bg-exam-alt',
    hint: 'שאלה שתקועה מעבר לתקציב? נחש, סמן, והמשך. אפשר לחזור אליה בסוף הפרק.',
  },
};

/**
 * The simulation's pace gauge: a calm, text-only status next to the timer.
 * No red, no numbers, no deficit counter; a status change settles for
 * PACE_STABLE_MS before it shows and then pulses once. Tapping it explains
 * the status and offers "real exam mode" (hide it). Silent until paceStatus
 * has something to say.
 */
export function PaceGauge({
  type, durationSec, expiresAt, clockSkewMs, answered, total,
}: {
  type: string;
  durationSec: number;
  /** ISO deadline of the current section (null = untimed). */
  expiresAt: string | null;
  clockSkewMs?: number;
  answered: number;
  total: number;
}) {
  const enabled = usePaceHint();
  const remainingMs = useCountdown({
    expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
    clockSkewMs,
  });
  const [shown, setShown] = useState<PaceStatus | null>(null);
  const [open, setOpen] = useState(false);
  const candidate = useRef<{ status: PaceStatus | null; since: number }>({ status: null, since: 0 });

  const raw = remainingMs === null
    ? null
    : paceStatus({ type, durationSec, elapsedSec: durationSec - remainingMs / 1000, answered, total });

  // Debounce: adopt a status only once it has held for PACE_STABLE_MS. The
  // very first status is shown at once — there is nothing to flicker from.
  useEffect(() => {
    const now = Date.now();
    if (raw !== candidate.current.status) candidate.current = { status: raw, since: now };
    if (raw === shown) return;
    if (shown === null || now - candidate.current.since >= PACE_STABLE_MS) {
      const t = setTimeout(() => setShown(raw), 0);
      return () => clearTimeout(t);
    }
  }, [raw, shown, remainingMs]);

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => setPaceHint(true)}
        className="hit-44 inline-flex items-center gap-1 text-[11px] text-exam-ink-soft hover:text-exam-ink"
      >
        <Eye className="w-3 h-3" aria-hidden />
        הצג מד קצב
      </button>
    );
  }
  if (!shown) return null;

  const look = LOOK[shown];
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-live="polite"
        className="hit-44 inline-flex items-center gap-1.5 rounded-full border border-exam-border bg-exam-surface px-2.5 py-0.5 text-[11px] font-semibold text-exam-ink-soft"
      >
        <span key={shown} className={`w-2 h-2 rounded-full ${look.dot} animate-check-pop`} aria-hidden />
        {look.label}
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 z-20 w-60 rounded-xl border border-exam-border bg-exam-surface p-3 text-right shadow-raised" role="dialog" aria-label="מד קצב">
          <p className="text-xs text-exam-ink leading-relaxed">{look.hint}</p>
          <button
            type="button"
            onClick={() => { setPaceHint(false); setOpen(false); }}
            className="mt-2 text-[11px] font-semibold text-exam-accent hover:underline"
          >
            הסתר (מצב אמת, בלי מד קצב)
          </button>
        </div>
      )}
    </div>
  );
}
