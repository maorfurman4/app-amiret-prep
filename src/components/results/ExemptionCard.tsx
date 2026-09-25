'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { EXEMPTION_SCORE } from '@/lib/calibration';
import { exemptionTone, formatProbability, scoreInterval, type ExemptionTone, type Measurement } from '@/lib/exemption';

/**
 * "Probability of 134+" — the honest replacement for the old fixed ±10
 * band. The gauge shows P(true level ≥ 134) from the measurement's real
 * standard error; the track below shows the score range that uncertainty
 * implies (80% interval) against the exemption line, so a student can see
 * both *how likely* and *why* (how close, how precise).
 *
 * Copy leans on natural frequencies ("about 7 in 10") because probabilities
 * stated as frequencies are understood far more reliably than percentages
 * alone (Gigerenzer & Hoffrage, 1995).
 */

const TONE: Record<ExemptionTone, { arc: string; band: string; text: string; glow: string; headline: string }> = {
  likely: {
    arc: 'stroke-exam-sage-strong',
    band: 'bg-exam-sage-strong',
    text: 'text-exam-sage-strong',
    glow: 'bg-exam-sage/25',
    headline: 'סיכוי גבוה לפטור',
  },
  close: {
    arc: 'stroke-exam-accent',
    band: 'bg-exam-accent',
    text: 'text-exam-accent',
    glow: 'bg-exam-accent/20',
    headline: 'ממש על הקו. כל מבחן נוסף מחדד את התמונה',
  },
  building: {
    arc: 'stroke-exam-alt',
    band: 'bg-exam-alt',
    text: 'text-exam-alt',
    glow: 'bg-exam-alt/20',
    headline: 'עוד בדרך לשם, ויש על מה לבנות',
  },
};

/** Who, among ten test-takers with this result, is actually at the exemption line. Verb agrees with the count. */
function frequencySentence(p: number): string {
  const inTen = Math.round(p * 10);
  const at = `בפועל ברמה של ${EXEMPTION_SCORE} ומעלה`;
  if (inTen <= 0) return `פחות מאחד מתוך 10 נבחנים עם תוצאה כמו שלך נמצא ${at}.`;
  if (inTen === 1) return `בערך אחד מתוך 10 נבחנים עם תוצאה כמו שלך נמצא ${at}.`;
  if (inTen >= 10) return `כמעט כל הנבחנים עם תוצאה כמו שלך נמצאים ${at}.`;
  return `בערך ${inTen} מתוך 10 נבחנים עם תוצאה כמו שלך נמצאים ${at}.`;
}

/** Position on the 50–150 track, as a % from the left: scales read low → high, left → right. */
const trackPct = (score: number) => Math.min(100, Math.max(0, score - 50));

// Semicircle geometry: an arc of radius R across a W×H box.
const W = 220;
const R = 92;
const STROKE = 16;
const CX = W / 2;
const CY = R + STROKE / 2 + 2;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

/** "134+" isolated as an LTR run, so RTL text around it can't reorder its
 * "+" or trailing punctuation (plain "ל-134+?" renders as "ל-?+134"). */
export function ExemptTarget() {
  return <bdi dir="ltr">{EXEMPTION_SCORE}+</bdi>;
}

export interface ExemptionCardProps {
  measurement: Measurement;
  heading: ReactNode;
  /** What the estimate rests on, e.g. "המבחן הזה" or "3 המבחנים האחרונים". */
  basis: string;
  /** The reported score to mark on the track, when there is one. */
  score?: number;
}

export function ExemptionCard({ measurement, heading, basis, score }: ExemptionCardProps) {
  const { p } = measurement;
  const pct = Math.round(p * 100);
  const tone = TONE[exemptionTone(p)];
  const { lo, hi } = scoreInterval(measurement);
  const precision = Math.round(measurement.se * 20);
  const headingId = useId();

  // Sweep the arc up from empty once mounted, so the value is "earned" on
  // screen rather than simply appearing.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative animate-fade-up">
      <div className={`absolute -inset-3 -z-10 rounded-[32px] blur-2xl ${tone.glow} animate-ambient-glow motion-reduce:animate-none`} aria-hidden />
      <section
        className="relative bg-exam-surface rounded-2xl shadow-raised hover:shadow-overlay hover:-translate-y-0.5 border border-exam-border dark:border-white/10 p-6 transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
        aria-labelledby={headingId}
      >
        <h2 id={headingId} className="font-bold text-exam-ink">{heading}</h2>
        <p className="text-xs text-exam-ink-soft mb-2">על בסיס {basis}</p>

        {/* Gauge */}
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${formatProbability(p)} סיכוי לציון ${EXEMPTION_SCORE} ומעלה`}
          aria-label={`הסיכוי לציון ${EXEMPTION_SCORE} ומעלה`}
          className="relative mx-auto w-full max-w-[240px]"
        >
          <svg viewBox={`0 0 ${W} ${CY + 6}`} className="w-full" aria-hidden>
            <path d={ARC} fill="none" strokeWidth={STROKE} strokeLinecap="round" className="stroke-exam-border" />
            <path
              d={ARC}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={revealed ? 100 - Math.max(pct, 1) : 100}
              className={`${tone.arc} transition-[stroke-dashoffset] duration-1000 ease-spring-soft motion-reduce:transition-none`}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            <span className={`text-5xl font-black tabular-nums leading-none animate-score-reveal ${tone.text}`} dir="ltr">
              {formatProbability(p)}
            </span>
            <span className="mt-1 text-xs font-semibold text-exam-ink-soft">
              סיכוי ל-<ExemptTarget />
            </span>
          </div>
        </div>

        <p className={`mt-4 text-center font-bold ${tone.text}`}>{tone.headline}</p>
        <p className="mt-1 text-center text-sm text-exam-ink-soft">
          {frequencySentence(p)}
        </p>

        {/* Where the measurement sits against the line: 80% range + cut + score */}
        <div className="mt-6" aria-hidden>
          <div className="relative h-3 rounded-full bg-exam-paper-alt border border-exam-border">
            <div
              className={`absolute inset-y-0 rounded-full opacity-35 ${tone.band}`}
              style={{ left: `${trackPct(lo)}%`, width: `${Math.max(trackPct(hi) - trackPct(lo), 1.5)}%` }}
            />
            <div className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-exam-sage-strong" style={{ left: `calc(${trackPct(EXEMPTION_SCORE)}% - 1px)` }} />
            {score !== undefined && (
              <div
                className="absolute top-1/2 size-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-exam-surface bg-exam-ink shadow-surface"
                style={{ left: `${trackPct(score)}%` }}
              />
            )}
          </div>
          <div className="relative mt-1.5 h-4 text-[11px] text-exam-ink-soft tabular-nums">
            <span className="absolute left-0">50</span>
            <span className="absolute font-semibold text-exam-sage-strong -translate-x-1/2" style={{ left: `${trackPct(EXEMPTION_SCORE)}%` }}>{EXEMPTION_SCORE}</span>
            <span className="absolute right-0">150</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-exam-ink-soft">
          טווח סביר לרמה שלך: <bdi dir="ltr" className="font-semibold text-exam-ink tabular-nums">{lo}–{hi}</bdi>
          {' '}(דיוק המדידה <bdi dir="ltr">±{precision}</bdi> נק׳).
        </p>

        <p className="mt-3 pt-3 border-t border-exam-border text-[11px] leading-relaxed text-exam-ink-soft">
          אומדן על הסקאלה הפנימית של האתר, לפי דיוק המדידה בפועל. זו לא תחזית רשמית של נית&quot;ה.
          כל מוסד לימודים קובע בעצמו את הסף לפטור.
        </p>
      </section>
    </div>
  );
}
