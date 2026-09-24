'use client';

import { useEffect, useState } from 'react';
import { todayLocalStr } from '@/lib/date-local';
import { AchievementGlow, useIncrease } from './AchievementMotion';
import { Check } from 'lucide-react';
import { ringProgress, type Rings } from '@/lib/rings';

/**
 * Three concentric Apple-Fitness-style rings for the home page's "Today"
 * card, each a science-backed learning signal computed on the server
 * (src/lib/rings.ts) — never a client-reported count:
 *   outer  (accent) — effortful practice: questions answered today in the
 *                     student's difficulty sweet spot
 *   middle (sage)   — due FSRS reviews completed today
 *   inner  (amber)  — a full, timed exam simulation this week
 * Hand-rolled SVG (stroke-dasharray/stroke-dashoffset) — three circles
 * don't need a charting library.
 */

const SIZE = 84;
const STROKE = 7;
const GAP = 2.5;
const RADII = [0, 1, 2].map(i => SIZE / 2 - STROKE / 2 - i * (STROKE + GAP));

const RING_STYLES = [
  { track: 'stroke-exam-border', fill: 'stroke-exam-accent', dot: 'bg-exam-accent' },
  { track: 'stroke-exam-border', fill: 'stroke-exam-sage', dot: 'bg-exam-sage' },
  { track: 'stroke-exam-border', fill: 'stroke-exam-alt', dot: 'bg-exam-alt' },
] as const;

function Ring({ r, ratio, fill, track }: { r: number; ratio: number; fill: string; track: string }) {
  const circumference = 2 * Math.PI * r;
  const c = SIZE / 2;
  return (
    <>
      <circle cx={c} cy={c} r={r} strokeWidth={STROKE} className={track} fill="none" />
      <circle
        cx={c} cy={c} r={r} strokeWidth={STROKE} fill="none"
        className={`${fill} transition-[stroke-dashoffset,stroke] duration-[900ms] ease-spring-soft motion-reduce:transition-none`}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </>
  );
}

export function DailyRings({ rings, persistCelebration = true }: { rings: Rings; persistCelebration?: boolean }) {
  const progress = ringProgress(rings);
  const ratios = [progress.effort, progress.retention, progress.simulation];
  const allClosed = ratios.every(r => r >= 1);
  const closure = useIncrease(allClosed ? 1 : 0);
  const [arrivalReward, setArrivalReward] = useState(false);
  useEffect(() => {
    if (!allClosed || !persistCelebration) return;
    const key = 'amiret_ring_celebration_seen_date';
    const today = todayLocalStr();
    try { if (localStorage.getItem(key) === today) return; } catch { /* Optional persistence. */ }
    const timer = setTimeout(() => {
      try { localStorage.setItem(key, today); } catch { /* Session-only reward. */ }
      setArrivalReward(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [allClosed, persistCelebration]);
  const celebrate = allClosed && (closure.increased || arrivalReward);
  const reviewsCaughtUp = rings.retention.due === 0;
  const retentionTarget = rings.retention.done + rings.retention.due;

  return (
    <div className="flex items-center gap-4 px-3" dir="rtl" role="group" aria-label="ההתקדמות שלך היום">
      <div className="relative isolate shrink-0">
        {celebrate && <AchievementGlow key={closure.revision} delay={720} />}
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-scale-x-100" aria-hidden>
          {RADII.map((r, i) => (
            <Ring key={i} r={r} ratio={ratios[i]} fill={RING_STYLES[i].fill} track={RING_STYLES[i].track} />
          ))}
        </svg>
        {allClosed && (
          <span
            role="img" aria-label="כל טבעות הלמידה הושלמו"
            className={`absolute inset-0 m-auto flex size-7 items-center justify-center rounded-full bg-exam-sage-bg text-exam-sage-strong shadow-progress ${celebrate ? 'ring-closure-check' : ''}`}
          >
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
        )}
      </div>

      <ul className="flex min-w-0 flex-col gap-1.5 text-label">
        <li className="flex items-center gap-1.5">
          <span className={`size-2 shrink-0 rounded-full ${RING_STYLES[0].dot}`} aria-hidden />
          <span className="text-exam-ink-soft">תרגול מאתגר</span>
          <span className="font-bold text-exam-ink tabular-nums" dir="ltr">{rings.effort.done}/{rings.effort.target}</span>
        </li>
        <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className={`size-2 shrink-0 rounded-full ${RING_STYLES[1].dot}`} aria-hidden />
          <span className="text-exam-ink-soft">חזרות בזמן</span>
          {reviewsCaughtUp ? (
            <span className="font-semibold text-exam-sage-strong">
              {rings.retention.done > 0 ? `הכול מעודכן · ${rings.retention.done} הושלמו` : 'אין חזרות ממתינות'}
            </span>
          ) : (
            <span className="font-bold text-exam-ink tabular-nums" dir="ltr">{rings.retention.done}/{retentionTarget}</span>
          )}
        </li>
        <li className="flex items-center gap-1.5">
          <span className={`size-2 shrink-0 rounded-full ${RING_STYLES[2].dot}`} aria-hidden />
          <span className="text-exam-ink-soft">סימולציה שבועית</span>
          {rings.simulation.done ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-exam-sage-strong">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
              בוצעה
            </span>
          ) : (
            <span className="font-semibold text-exam-ink">טרם השבוע</span>
          )}
        </li>
      </ul>
    </div>
  );
}
